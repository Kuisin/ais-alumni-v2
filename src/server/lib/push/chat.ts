import { AccountState, ChatGroupKind } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { blockedUserIds } from "@/server/lib/authz";
import { chatGroupName } from "@/server/lib/chat-labels";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { NOTIFY_USER_SELECT, notifyBatch } from "@/server/lib/notify";
import { membersWithPush } from "./devices";

/**
 * A new chat message, pushed right away to members who get notifications
 * in the app (called after the message is saved; never throws):
 *  - 1:1 talks: the other member (CHAT_DIRECT);
 *  - groups: members mentioned by name (CHAT_MENTION), and members who
 *    chose "every message" for the group (ChatMember.pushAll, not muted;
 *    CHAT_GROUP). @全員 isn't pushed (the daily summary covers it).
 * Never the message text (catalog rules). One notification per chat is
 * kept on the phone (collapse), so a burst shows as the latest.
 *
 * Members without the app keep the 5-minute LINE / email notice
 * (src/lib/jobs/chat-unread.ts); those pushed here are logged under the
 * same kind and chat, so that job skips them for this unread streak.
 */
export async function pushChatMessage(input: {
  groupId: string;
  senderId: string;
  mentionUserIds: readonly string[];
}): Promise<void> {
  try {
    const group = await db.chatGroup.findUnique({
      where: { id: input.groupId },
      select: {
        kind: true,
        cohort: { select: { number: true, elementaryEndYear: true } },
        members: { select: { userId: true, muted: true, pushAll: true } },
      },
    });
    if (!group) return;
    const direct = group.kind === ChatGroupKind.DIRECT;
    const others = group.members.filter((m) => m.userId !== input.senderId);
    const byKind = {
      CHAT_DIRECT: direct ? others.map((m) => m.userId) : [],
      CHAT_MENTION: direct
        ? []
        : others
            .filter((m) => input.mentionUserIds.includes(m.userId))
            .map((m) => m.userId),
      CHAT_GROUP: [] as string[],
    };
    if (!direct)
      byKind.CHAT_GROUP = others
        .filter(
          (m) =>
            m.pushAll && !m.muted && !byKind.CHAT_MENTION.includes(m.userId),
        )
        .map((m) => m.userId);
    const candidates = Object.values(byKind).flat();
    if (candidates.length === 0) return;

    // Only members with the app; nobody who blocked (or was blocked by)
    // the sender.
    const [withApp, blocked] = await Promise.all([
      membersWithPush(candidates),
      blockedUserIds(input.senderId),
    ]);
    const wanted = candidates.filter(
      (id) => withApp.has(id) && !blocked.includes(id),
    );
    if (wanted.length === 0) return;
    const [people, sender] = await Promise.all([
      db.user.findMany({
        where: { id: { in: wanted }, state: AccountState.ACTIVE },
        select: NOTIFY_USER_SELECT,
      }),
      db.user.findUnique({
        where: { id: input.senderId },
        select: { nameRomaji: true, nameKanji: true },
      }),
    ]);
    const params = async (locale: "ja" | "en") => ({
      name: sender ? displayName(sender, locale) : "—",
      group: direct
        ? ""
        : chatGroupName(await getTranslatorFor(locale, "chat"), group, locale),
    });
    for (const kind of ["CHAT_DIRECT", "CHAT_MENTION", "CHAT_GROUP"] as const) {
      const to = people.filter((p) => byKind[kind].includes(p.id));
      if (to.length === 0) continue;
      await notifyBatch(to, {
        kind,
        refId: input.groupId,
        path: `/app/chat/${input.groupId}`,
        params,
        pushOnly: true,
        link: false,
        push: {
          collapseId: `chat-${input.groupId}`,
          threadId: `chat-${input.groupId}`,
          // Old chat notices aren't worth delivering days later.
          ttl: 24 * 60 * 60,
        },
      });
    }
  } catch (e) {
    console.error("[push] chat message push failed", e);
  }
}
