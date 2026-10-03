/**
 * Unread 1:1 messages and personal @mentions: once one has sat unread for
 * UNREAD_DELAY_MS, the recipient is told once (LINE if they use it, else
 * email). The delay and "once" keep LINE pushes few (monthly quota). "Once" is
 * per unread streak: nothing more is sent for that chat until they've read
 * it (the job skips members notified since their lastReadAt), so later
 * messages don't repeat it; after they read, the next unread message
 * starts a new streak. @全員 isn't pushed (the daily summary covers it).
 * Pure: the job loads the rows.
 */
export const UNREAD_DELAY_MS = 5 * 60 * 1000;
/** Only messages this recent are considered (no backlog blasts). */
export const UNREAD_WINDOW_MS = 2 * 60 * 60 * 1000;

export type UnreadCandidate = {
  id: string;
  groupId: string;
  senderId: string;
  createdAt: Date;
  direct: boolean;
  mentionUserIds: readonly string[];
  /** members of the chat and when each last read it */
  members: readonly { userId: string; lastReadAt: Date }[];
};

export type UnreadNotice = {
  kind: "CHAT_DIRECT" | "CHAT_MENTION";
  userId: string;
  groupId: string;
  /** the oldest unread qualifying message and its sender */
  messageId: string;
  senderId: string;
  /** the member's last read time in this chat (a streak starts after it) */
  lastReadAt: Date;
};

/** Already told about this streak: a notice for the chat since they read it. */
export function alreadyNotified(
  n: Pick<UnreadNotice, "lastReadAt">,
  lastSentAt: Date | null | undefined,
): boolean {
  return Boolean(lastSentAt && lastSentAt > n.lastReadAt);
}

export function pickUnreadNotices(
  messages: readonly UnreadCandidate[],
  now: Date,
): UnreadNotice[] {
  const cutoff = now.getTime() - UNREAD_DELAY_MS;
  const oldest = new Map<string, UnreadNotice & { at: number }>();
  for (const m of messages) {
    const at = m.createdAt.getTime();
    if (at > cutoff || at < now.getTime() - UNREAD_WINDOW_MS) continue;
    for (const member of m.members) {
      if (member.userId === m.senderId) continue;
      // Read since it was sent.
      if (member.lastReadAt.getTime() >= at) continue;
      const kind = m.direct
        ? "CHAT_DIRECT"
        : m.mentionUserIds.includes(member.userId)
          ? "CHAT_MENTION"
          : null;
      if (!kind) continue;
      const key = `${member.userId}:${m.groupId}:${kind}`;
      const prev = oldest.get(key);
      if (!prev || at < prev.at)
        oldest.set(key, {
          kind,
          userId: member.userId,
          groupId: m.groupId,
          messageId: m.id,
          senderId: m.senderId,
          lastReadAt: member.lastReadAt,
          at,
        });
    }
  }
  return [...oldest.values()].map(({ at: _at, ...n }) => n);
}
