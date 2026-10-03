import { webPathFor } from "@/lib/site-paths";
import { AccountState, ChatGroupKind } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import {
  chatMentionedGroups,
  chatUnreadByGroup,
  GROUP_SELECT,
} from "@/server/lib/chat-db";
import { chatGroupName } from "@/server/lib/chat-labels";
import { db } from "@/server/lib/db";
import { localized } from "@/server/lib/format";
import type { LineTextMessage } from "@/server/lib/line";
import {
  chatsReply,
  type LineReplyKind,
  newsReply,
  type ReplyChat,
} from "@/server/lib/line-reply";
import { visibleNews } from "@/server/lib/news-visibility";
import { publicUrl } from "@/server/lib/urls";

/**
 * The reply to 未読のチャット / ニュース一覧 for the member linked to this
 * LINE account: the same chats, posts and unread state as in the app.
 */
export async function lineReplyFor(
  lineUserId: string,
  kind: LineReplyKind,
): Promise<LineTextMessage[]> {
  const user = await db.user.findFirst({
    where: { lineUserId },
    include: { roles: true },
  });
  if (!user) {
    // Unknown LINE account: both languages, and where to link it.
    const [ja, en] = await Promise.all([
      getTranslatorFor("ja", "line"),
      getTranslatorFor("en", "line"),
    ]);
    return [
      {
        type: "text",
        text: `${ja("reply.notLinked")}\n${en("reply.notLinked")}\n\n${publicUrl(webPathFor("/app/settings#line"))}`,
      },
    ];
  }
  const locale = user.locale === "en" ? "en" : "ja";
  const t = await getTranslatorFor(locale, "line");
  if (user.state !== AccountState.ACTIVE) {
    return [
      {
        type: "text",
        text: `${t("reply.notActive")}\n\n${publicUrl("/")}`,
      },
    ];
  }
  const opts = {
    t: (k: string, v?: Record<string, string | number>) => t(`reply.${k}`, v),
    locale,
    url: publicUrl,
  } as const;
  return kind === "chats"
    ? chatsReply(await unreadChats(user.id, locale), opts)
    : newsReply(await newsPosts(user, locale, t), opts);
}

/** Talks with unread messages, most recent activity first (as in the app). */
async function unreadChats(
  userId: string,
  locale: "ja" | "en",
): Promise<ReplyChat[]> {
  const [unread, mentioned] = await Promise.all([
    chatUnreadByGroup(userId),
    chatMentionedGroups(userId),
  ]);
  if (unread.size === 0) return [];
  const tc = await getTranslatorFor(locale, "chat");
  const groups = await db.chatGroup.findMany({
    where: { id: { in: [...unread.keys()] } },
    select: {
      ...GROUP_SELECT,
      members: {
        where: { userId: { not: userId } },
        take: 1,
        select: { user: { select: { nameRomaji: true, nameKanji: true } } },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  return groups
    .map((g) => ({
      id: g.id,
      name:
        g.kind === ChatGroupKind.DIRECT
          ? (g.members[0]?.user.nameRomaji ??
            g.members[0]?.user.nameKanji ??
            "—")
          : chatGroupName(tc, g, locale),
      unread: unread.get(g.id) ?? 0,
      mentioned: mentioned.has(g.id),
      lastAt: g.messages[0]?.createdAt.getTime() ?? 0,
    }))
    .sort((a, b) => b.lastAt - a.lastAt)
    .map(({ lastAt: _, ...c }) => c);
}

/** Every post the member can see, newest first, with its unread state. */
async function newsPosts(
  user: Parameters<typeof visibleNews>[0],
  locale: "ja" | "en",
  t: (k: string) => string,
) {
  // Posts shown only because the member is an admin never count as theirs.
  const visible = (await visibleNews(user)).filter(
    (p): p is typeof p & { publishedAt: Date } =>
      !p.adminView && p.publishedAt !== null,
  );
  visible.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  const ids = visible.map((p) => p.id);
  const [read, titles] = await Promise.all([
    db.newsRead
      .findMany({
        where: { userId: user.id, postId: { in: ids } },
        select: { postId: true },
      })
      .then((rows) => new Set(rows.map((r) => r.postId))),
    db.newsPost
      .findMany({
        where: { id: { in: ids } },
        select: { id: true, titleJa: true, titleEn: true },
      })
      .then(
        (rows) =>
          new Map(
            rows.map((p) => [
              p.id,
              localized(p.titleJa, p.titleEn, locale).text ||
                t("reply.untitled"),
            ]),
          ),
      ),
  ]);
  // Unread like the app's badge: posted since they joined, not opened.
  return visible.map((p) => ({
    id: p.id,
    title: titles.get(p.id) ?? "",
    publishedAt: p.publishedAt,
    unread: !read.has(p.id) && p.publishedAt >= user.createdAt,
  }));
}
