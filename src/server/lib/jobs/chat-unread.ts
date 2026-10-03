import { AccountState, ChatGroupKind } from "@/server/generated/prisma/enums";
import {
  alreadyNotified,
  pickUnreadNotices,
  UNREAD_DELAY_MS,
  UNREAD_WINDOW_MS,
  type UnreadCandidate,
} from "@/server/lib/chat-unread";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import {
  type JobContext,
  type JobStep,
  PartialFailure,
  pastDeadline,
} from "@/server/lib/jobs/context";
import { NOTIFY_USER_SELECT, notify } from "@/server/lib/notify";

/**
 * Every minute: 1:1 messages and personal @mentions unread for 5 minutes →
 * one LINE (or email) notice per unread streak (src/lib/chat-unread.ts).
 */
export async function sendUnreadChatNotices(ctx: JobContext): Promise<JobStep> {
  const now = new Date();
  const createdAt = {
    gte: new Date(now.getTime() - UNREAD_WINDOW_MS),
    lte: new Date(now.getTime() - UNREAD_DELAY_MS),
  };
  const [direct, mentions] = await Promise.all([
    db.chatMessage.findMany({
      where: {
        deletedAt: null,
        createdAt,
        group: { kind: ChatGroupKind.DIRECT },
      },
      select: {
        id: true,
        groupId: true,
        userId: true,
        createdAt: true,
        group: {
          select: { members: { select: { userId: true, lastReadAt: true } } },
        },
      },
    }),
    db.chatMessage.findMany({
      where: {
        deletedAt: null,
        createdAt,
        mentionUserIds: { isEmpty: false },
        group: { kind: { not: ChatGroupKind.DIRECT } },
      },
      select: {
        id: true,
        groupId: true,
        userId: true,
        createdAt: true,
        mentionUserIds: true,
      },
    }),
  ]);
  // Only the mentioned members' read state is needed for group chats.
  const mentionReads = mentions.length
    ? await db.chatMember.findMany({
        where: {
          OR: mentions.map((m) => ({
            groupId: m.groupId,
            userId: { in: m.mentionUserIds },
          })),
        },
        select: { groupId: true, userId: true, lastReadAt: true },
      })
    : [];
  const candidates: UnreadCandidate[] = [
    ...direct.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      senderId: m.userId,
      createdAt: m.createdAt,
      direct: true,
      mentionUserIds: [],
      members: m.group.members,
    })),
    ...mentions.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      senderId: m.userId,
      createdAt: m.createdAt,
      direct: false,
      mentionUserIds: m.mentionUserIds,
      members: mentionReads.filter((r) => r.groupId === m.groupId),
    })),
  ];
  const picked = pickUnreadNotices(candidates, now);
  if (!picked.length) return { done: true, result: { sent: 0 } };

  // Skip members already told about this chat since they last read it.
  const logs = await db.notificationLog.findMany({
    where: {
      userId: { in: [...new Set(picked.map((n) => n.userId))] },
      kind: { in: ["CHAT_DIRECT", "CHAT_MENTION"] },
      refId: { in: [...new Set(picked.map((n) => n.groupId))] },
    },
    select: { userId: true, kind: true, refId: true, sentAt: true },
  });
  const lastSent = new Map<string, Date>();
  for (const l of logs) {
    const key = `${l.userId}:${l.refId}:${l.kind}`;
    const prev = lastSent.get(key);
    if (!prev || l.sentAt > prev) lastSent.set(key, l.sentAt);
  }
  const due = picked.filter(
    (n) =>
      !alreadyNotified(n, lastSent.get(`${n.userId}:${n.groupId}:${n.kind}`)),
  );
  if (!due.length) return { done: true, result: { sent: 0 } };

  const people = await db.user.findMany({
    where: {
      id: { in: [...new Set(due.flatMap((n) => [n.userId, n.senderId]))] },
    },
    select: { ...NOTIFY_USER_SELECT, state: true },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  let sent = 0;
  let failed = 0;
  for (const n of due) {
    if (pastDeadline(ctx)) break;
    const to = byId.get(n.userId);
    const sender = byId.get(n.senderId);
    if (!to || to.state !== AccountState.ACTIVE) continue;
    try {
      await notify(to, {
        kind: n.kind,
        refId: n.groupId,
        path: `/app/chat/${n.groupId}`,
        params: (locale) => ({
          name: sender ? displayName(sender, locale) : "—",
        }),
      });
      sent++;
    } catch (e) {
      console.error(`[chat-unread] notice to ${n.userId} failed`, e);
      failed++;
    }
  }
  const result = { sent, failed, due: due.length };
  if (failed) throw new PartialFailure(`${failed} notice(s) failed`, result);
  return { done: true, result };
}
