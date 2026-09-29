import type {
  MessageDetail,
  MessageList,
  MessageSummary,
} from "@contract/news";
import { getTranslations } from "next-intl/server";
import type { PositionKey } from "@/server/generated/prisma/enums";
import { BroadcastScope } from "@/server/generated/prisma/enums";
import { listMessages, openMessage } from "@/server/lib/announcements";
import { effectiveAudiences } from "@/server/lib/audience";
import { cohortLabel } from "@/server/lib/cohorts";
import { MESSAGES_ENABLED } from "@/server/lib/features";
import { displayName } from "@/server/lib/format";
import { notFound } from "@/server/lib/mobile/http";
import type { CurrentUser } from "@/server/lib/session";

/**
 * あなた宛ての連絡 (the website's /app/news?tab=messages and
 * /app/news/messages/[id]). Switched off on the website for now
 * (MESSAGES_ENABLED): then both answer 404, as the website's pages do.
 */

type Sender = { nameRomaji: string | null; nameKanji: string | null };

/** 「Name（Class representative）」, or the committee when an admin sent it. */
async function senderLabel(
  sender: Sender,
  position: PositionKey | null,
  locale: "ja" | "en",
): Promise<string> {
  const t = await getTranslations({ locale, namespace: "broadcast" });
  return position
    ? t("fromPosition", {
        name: displayName(sender),
        position: t(`positions.${position}`),
      })
    : t("fromCommittee");
}

export async function messageList(
  user: CurrentUser,
  page: number,
  locale: "ja" | "en",
): Promise<MessageList> {
  if (!MESSAGES_ENABLED) throw notFound();
  const { rows, pages } = await listMessages(user.id, page);
  const messages: MessageSummary[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.broadcast.id,
      title: r.broadcast.title,
      sender: await senderLabel(
        r.broadcast.sender,
        r.broadcast.position,
        locale,
      ),
      sentAt: r.broadcast.createdAt.toISOString(),
      edited: Boolean(r.broadcast.editedAt),
      unread: !r.readAt,
    })),
  );
  return { page, hasNext: page < pages, messages };
}

export async function messageDetail(
  user: CurrentUser,
  id: string,
  locale: "ja" | "en",
): Promise<MessageDetail> {
  if (!MESSAGES_ENABLED) throw notFound();
  const msg = await openMessage(user, id);
  if (!msg) throw notFound();
  const b = msg.broadcast;
  const [t, tr] = await Promise.all([
    getTranslations({ locale, namespace: "news" }),
    getTranslations({ locale, namespace: "roles" }),
  ]);
  let sentTo: string;
  if (b.scope === BroadcastScope.COHORT) {
    // The 学年 may have been deleted since (cohortId is set null).
    sentTo = b.cohort ? cohortLabel(b.cohort, locale) : "—";
  } else {
    const audiences = effectiveAudiences(b);
    sentTo = audiences.length
      ? audiences
          .map((a) => tr(`audience.${a}`))
          .join(locale === "ja" ? "・" : ", ")
      : t("messages.toAll");
  }
  return {
    id: b.id,
    title: b.title,
    body: b.body,
    sender: await senderLabel(b.sender, b.position, locale),
    sentAt: b.createdAt.toISOString(),
    edited: Boolean(b.editedAt),
    sentTo,
    isRecipient: msg.isRecipient,
  };
}
