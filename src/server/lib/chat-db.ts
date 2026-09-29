import type { Prisma } from "@/server/generated/prisma/client";
import {
  AccountState,
  ChatGroupKind,
  FollowStatus,
  PositionKey,
  RoleKey,
} from "@/server/generated/prisma/enums";
import { AVATAR_SELECT } from "@/server/lib/avatar";
import { desiredGroups, directKey, isAdult } from "@/server/lib/chat";
import { db } from "@/server/lib/db";
import {
  canHaveDirect,
  type DirectRules,
  directAllowed,
  mergeDirectRules,
} from "@/server/lib/direct-policy";
import {
  ADULTS_CHAT_ENABLED,
  CLASS_REPS_CHAT_ENABLED,
  COMMITTEE_CHAT_ENABLED,
  DIRECT_CHAT_ENABLED,
  GRADUATE_CHATS_ENABLED,
} from "@/server/lib/features";
import { NOTIFY_USER_SELECT, notifyBatch } from "@/server/lib/notify";

type Client = Prisma.TransactionClient | typeof db;

const STUDENT: RoleKey[] = [RoleKey.CURRENT_STUDENT, RoleKey.FORMER_STUDENT];

/**
 * Put the member in (and take them out of) the groups for their type and
 * 学年. Only ACTIVE members are in groups. New members start with nothing
 * unread. Returns true if anything changed.
 */
export async function syncChatMembership(
  userId: string,
  client: Client = db,
  now: Date = new Date(),
): Promise<boolean> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      state: true,
      isAdmin: true,
      dateOfBirth: true,
      managedById: true,
      positions: {
        where: {
          position: {
            in: [PositionKey.STUDENT_LEADER, PositionKey.ALUMNI_COMMITTEE],
          },
        },
        select: { position: true },
      },
      roles: { select: { role: true, cohortId: true, didGraduate: true } },
      parentLinks: {
        select: {
          childCohortId: true,
          child: {
            select: {
              roles: {
                where: { role: { in: STUDENT }, cohortId: { not: null } },
                select: { cohortId: true },
              },
            },
          },
        },
      },
    },
  });
  // Only the automatic groups are managed here; 1:1 talks stay as they are.
  const current = await client.chatMember.findMany({
    where: { userId, group: { kind: { not: ChatGroupKind.DIRECT } } },
    select: { groupId: true, group: { select: { key: true } } },
  });
  // Parent-managed child accounts can't sign in: no chats for them.
  if (!user || user.state !== AccountState.ACTIVE || user.managedById) {
    if (!current.length) return false;
    await client.chatMember.deleteMany({
      where: { userId, groupId: { in: current.map((m) => m.groupId) } },
    });
    return true;
  }
  const childCohorts = new Set<string>();
  for (const l of user.parentLinks) {
    const own = l.child?.roles[0]?.cohortId;
    if (own) childCohorts.add(own);
    else if (l.childCohortId) childCohorts.add(l.childCohortId);
  }
  const want = desiredGroups(user.roles, [...childCohorts], {
    adult: ADULTS_CHAT_ENABLED && isAdult(user.dateOfBirth, now),
    graduates: GRADUATE_CHATS_ENABLED,
    // 学年代表 need a (former) student role, like the position itself.
    rep:
      CLASS_REPS_CHAT_ENABLED &&
      user.positions.some((p) => p.position === PositionKey.STUDENT_LEADER) &&
      user.roles.some((r) => STUDENT.includes(r.role)),
    // 同窓会委員: the position, or an admin (the committee running the app).
    committee:
      COMMITTEE_CHAT_ENABLED &&
      (user.isAdmin ||
        user.positions.some(
          (p) => p.position === PositionKey.ALUMNI_COMMITTEE,
        )),
  });
  const have = new Map(current.map((m) => [m.group.key, m.groupId]));
  let changed = false;

  for (const g of want) {
    if (have.has(g.key)) continue;
    const group = await client.chatGroup.upsert({
      where: { key: g.key },
      create: g,
      update: {},
      select: { id: true },
    });
    await client.chatMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: { groupId: group.id, userId },
      update: {},
    });
    changed = true;
  }
  const keep = new Set(want.map((g) => g.key));
  const leave = current.filter((m) => !keep.has(m.group.key));
  if (leave.length) {
    await client.chatMember.deleteMany({
      where: { userId, groupId: { in: leave.map((m) => m.groupId) } },
    });
    changed = true;
  }
  return changed;
}

/**
 * Members whose groups the daily sync-status job refreshes (roles change
 * with the school year), in id order, for syncChatMembership.
 */
export async function chatSyncUserIds(): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      OR: [{ state: AccountState.ACTIVE }, { chatMembers: { some: {} } }],
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return users.map((u) => u.id);
}

/** Unread messages (not the member's own) across their groups. */
export async function chatUnreadTotal(userId: string): Promise<number> {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n
    FROM "ChatMessage" m
    JOIN "ChatMember" cm ON cm."groupId" = m."groupId" AND cm."userId" = ${userId}
    WHERE m."createdAt" > cm."lastReadAt"
      AND m."userId" <> ${userId}
      AND m."deletedAt" IS NULL`;
  return Number(rows[0]?.n ?? 0);
}

/** Unread count per group for the member. */
export async function chatUnreadByGroup(
  userId: string,
): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ groupId: string; n: bigint }[]>`
    SELECT m."groupId", count(*) AS n
    FROM "ChatMessage" m
    JOIN "ChatMember" cm ON cm."groupId" = m."groupId" AND cm."userId" = ${userId}
    WHERE m."createdAt" > cm."lastReadAt"
      AND m."userId" <> ${userId}
      AND m."deletedAt" IS NULL
    GROUP BY m."groupId"`;
  return new Map(rows.map((r) => [r.groupId, Number(r.n)]));
}

/** Chats with an unread message that mentions the member (or @全員). */
export async function chatMentionedGroups(
  userId: string,
): Promise<Set<string>> {
  const rows = await db.$queryRaw<{ groupId: string }[]>`
    SELECT DISTINCT m."groupId"
    FROM "ChatMessage" m
    JOIN "ChatMember" cm ON cm."groupId" = m."groupId" AND cm."userId" = ${userId}
    WHERE m."createdAt" > cm."lastReadAt"
      AND m."userId" <> ${userId}
      AND m."deletedAt" IS NULL
      AND (m."mentionAll" OR ${userId} = ANY(m."mentionUserIds"))`;
  return new Set(rows.map((r) => r.groupId));
}

export const GROUP_SELECT = {
  id: true,
  kind: true,
  cohort: { select: { number: true, elementaryEndYear: true } },
} as const;

/**
 * Daily digest: one LINE/email per member with unread messages from the
 * last day in groups they haven't muted. No content, only a count + link.
 * `now` is the digest's time (the job's slot), so a retry sends the same
 * day's digest; deduped per member and day, it reaches only those not
 * reached yet. Stops starting new sends at `deadline`.
 */
export async function sendChatDigest(
  now: Date = new Date(),
  opts: { deadline?: number } = {},
): Promise<{ recipients: number; failed: number; remaining: number }> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await db.$queryRaw<{ userId: string; n: bigint }[]>`
    SELECT cm."userId", count(*) AS n
    FROM "ChatMessage" m
    JOIN "ChatMember" cm ON cm."groupId" = m."groupId"
    JOIN "User" u ON u.id = cm."userId"
    WHERE m."createdAt" > cm."lastReadAt"
      AND m."createdAt" > ${since}
      AND m."userId" <> cm."userId"
      AND m."deletedAt" IS NULL
      AND NOT cm.muted
      AND u.state = 'ACTIVE'
    GROUP BY cm."userId"`;
  if (rows.length === 0) return { recipients: 0, failed: 0, remaining: 0 };
  const counts = new Map(rows.map((r) => [r.userId, Number(r.n)]));
  const users = await db.user.findMany({
    where: { id: { in: [...counts.keys()] } },
    select: NOTIFY_USER_SELECT,
  });
  const day = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  // One notification call per count, so each member sees their own number.
  const byCount = new Map<number, typeof users>();
  for (const u of users) {
    const n = counts.get(u.id) ?? 0;
    byCount.set(n, [...(byCount.get(n) ?? []), u]);
  }
  let recipients = 0;
  let failed = 0;
  let remaining = 0;
  for (const [count, group] of byCount) {
    if (opts.deadline !== undefined && Date.now() > opts.deadline) {
      remaining += group.length;
      continue;
    }
    const res = await notifyBatch(
      group,
      {
        kind: "CHAT_DIGEST",
        refId: day,
        dedupe: true,
        path: "/app/chat",
        params: { count },
      },
      { deadline: opts.deadline },
    );
    recipients += res.sent.size;
    failed += res.failed.length;
    remaining += res.remaining.length;
  }
  return { recipients, failed, remaining };
}

export type DirectDenial =
  | "disabled"
  | "self"
  | "notFound"
  | "restricted"
  | "notFriends"
  | "blocked";

/** The 1:1 talk rules per member type (admin → チャット). */
export async function loadDirectRules(): Promise<DirectRules> {
  return mergeDirectRules(
    await db.directChatPolicy.findMany({ select: { role: true, rule: true } }),
  );
}

async function rolesOf(userId: string): Promise<RoleKey[]> {
  const rows = await db.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  return rows.map((r) => r.role);
}

/** The member's type allows 1:1 talks at all (the 新しいトーク button). */
export async function directChatAvailable(userId: string): Promise<boolean> {
  if (!DIRECT_CHAT_ENABLED) return false;
  const [roles, rules] = await Promise.all([
    rolesOf(userId),
    loadDirectRules(),
  ]);
  return canHaveDirect(roles, rules);
}

/**
 * The two members' types don't allow a 1:1 talk between them (e.g. 在校生).
 * Checked again on every message, so a changed rule or type also stops
 * existing talks.
 */
export async function directRestricted(
  aId: string,
  bId: string,
): Promise<boolean> {
  const [a, b, rules] = await Promise.all([
    rolesOf(aId),
    rolesOf(bId),
    loadDirectRules(),
  ]);
  return !directAllowed(a, b, rules);
}

export type DirectStop = "blocked" | "restricted";

/**
 * Why an existing 1:1 talk can't go on: either side has blocked the other,
 * or their member types no longer allow it. Null = it can.
 */
export async function directStopReason(
  meId: string,
  otherId: string,
): Promise<DirectStop | null> {
  const block = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: meId, blockedId: otherId },
        { blockerId: otherId, blockedId: meId },
      ],
    },
    select: { id: true },
  });
  if (block) return "blocked";
  if (await directRestricted(meId, otherId)) return "restricted";
  return null;
}

/**
 * Who may start a 1:1 talk: mutual followers (like LINE friends), both
 * active, never across a block, and only as their member types allow.
 * Parent-managed child accounts can't.
 */
export async function directChatDenial(
  meId: string,
  otherId: string,
): Promise<DirectDenial | null> {
  if (!DIRECT_CHAT_ENABLED) return "disabled";
  if (meId === otherId) return "self";
  const other = await db.user.findUnique({
    where: { id: otherId },
    select: { state: true, managedById: true },
  });
  if (!other || other.state !== AccountState.ACTIVE || other.managedById)
    return "notFound";
  if (await directRestricted(meId, otherId)) return "restricted";
  const [follows, block] = await Promise.all([
    db.follow.count({
      where: {
        status: FollowStatus.ACCEPTED,
        OR: [
          { followerId: meId, followeeId: otherId },
          { followerId: otherId, followeeId: meId },
        ],
      },
    }),
    db.block.findFirst({
      where: {
        OR: [
          { blockerId: meId, blockedId: otherId },
          { blockerId: otherId, blockedId: meId },
        ],
      },
      select: { id: true },
    }),
  ]);
  if (block) return "blocked";
  if (follows < 2) return "notFriends";
  return null;
}

/** The 1:1 talk between two members (created on first use). */
export async function openDirectChat(
  meId: string,
  otherId: string,
): Promise<string> {
  const key = directKey(meId, otherId);
  const group = await db.chatGroup.upsert({
    where: { key },
    create: { key, kind: ChatGroupKind.DIRECT },
    update: {},
    select: { id: true },
  });
  for (const userId of [meId, otherId])
    await db.chatMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: { groupId: group.id, userId },
      update: {},
    });
  return group.id;
}

/**
 * Mutual followers the member can start a talk with (by name), as their
 * member types allow.
 */
export async function directChatCandidates(meId: string) {
  const [myRoles, rules] = await Promise.all([
    rolesOf(meId),
    loadDirectRules(),
  ]);
  if (!canHaveDirect(myRoles, rules)) return [];
  const mine = await db.follow.findMany({
    where: { followerId: meId, status: FollowStatus.ACCEPTED },
    select: { followeeId: true },
  });
  const theirs = await db.follow.findMany({
    where: {
      followeeId: meId,
      status: FollowStatus.ACCEPTED,
      followerId: { in: mine.map((f) => f.followeeId) },
    },
    select: { followerId: true },
  });
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: meId }, { blockedId: meId }] },
    select: { blockerId: true, blockedId: true },
  });
  const blocked = new Set(
    blocks.map((b) => (b.blockerId === meId ? b.blockedId : b.blockerId)),
  );
  const people = await db.user.findMany({
    where: {
      id: {
        in: theirs.map((f) => f.followerId).filter((id) => !blocked.has(id)),
      },
      state: AccountState.ACTIVE,
      managedById: null,
    },
    orderBy: { nameRomaji: "asc" },
    select: {
      nameRomaji: true,
      nameKanji: true,
      ...AVATAR_SELECT,
      roles: { select: { role: true } },
    },
  });
  return people.filter((p) =>
    directAllowed(
      myRoles,
      p.roles.map((r) => r.role),
      rules,
    ),
  );
}
