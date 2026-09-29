import { FollowStatus } from "@/server/generated/prisma/enums";
import { unreadCounts } from "@/server/lib/announcements";
import { db } from "@/server/lib/db";

/**
 * The app icon's number for these members: what the app's tab bar shows —
 * unread ニュース (and messages), unread chat messages and follow requests
 * (as in src/lib/mobile/me.ts). Only computed for push recipients. Members
 * the count can't be worked out for are left out (no badge change).
 */
export async function badgeCountsFor(
  userIds: readonly string[],
): Promise<Map<string, number>> {
  const ids = [...new Set(userIds)];
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const [users, chat, follows] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, include: { roles: true } }),
    db.$queryRaw<{ userId: string; n: bigint }[]>`
      SELECT cm."userId", count(*) AS n
      FROM "ChatMessage" m
      JOIN "ChatMember" cm ON cm."groupId" = m."groupId"
      WHERE cm."userId" = ANY(${ids})
        AND m."createdAt" > cm."lastReadAt"
        AND m."userId" <> cm."userId"
        AND m."deletedAt" IS NULL
      GROUP BY cm."userId"`,
    db.follow.groupBy({
      by: ["followeeId"],
      where: { followeeId: { in: ids }, status: FollowStatus.REQUESTED },
      _count: { _all: true },
    }),
  ]);
  const chatBy = new Map(chat.map((r) => [r.userId, Number(r.n)]));
  const followsBy = new Map(follows.map((r) => [r.followeeId, r._count._all]));
  for (const u of users) {
    try {
      const unread = await unreadCounts(u);
      out.set(
        u.id,
        unread.news +
          unread.messages +
          (chatBy.get(u.id) ?? 0) +
          (followsBy.get(u.id) ?? 0),
      );
    } catch (e) {
      console.error(`[push] badge for ${u.id} failed`, e);
    }
  }
  return out;
}
