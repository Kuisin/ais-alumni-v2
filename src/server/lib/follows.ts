import { Prisma } from "@/server/generated/prisma/client";
import { FollowStatus, RoleKey } from "@/server/generated/prisma/enums";
import {
  canRequestFollow,
  type FollowDenial,
  loadRelationship,
  sameFamily,
  shouldAutoAccept,
  toTarget,
  toViewer,
} from "@/server/lib/authz";
import { db } from "@/server/lib/db";
import { PUBLIC_CARD_SELECT } from "@/server/lib/directory";
import { displayName } from "@/server/lib/format";
import { NOTIFY_USER_SELECT, notify } from "@/server/lib/notify";
import type { CurrentUser } from "@/server/lib/session";

/** Follow requests and blocks (§9.2). */

export const FOLLOW_RATE_LIMIT = 30;
export const FOLLOW_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function followRateWindowStart(now: Date): Date {
  return new Date(now.getTime() - FOLLOW_RATE_WINDOW_MS);
}

/** Max 30 follow requests per follower per rolling 24h (§9.2). */
export function isFollowRateLimited(requestsInWindow: number): boolean {
  return requestsInWindow >= FOLLOW_RATE_LIMIT;
}

export function formerStudentYear(
  roles: readonly { role: RoleKey; graduationOrLeaveYear: number | null }[],
): number | null {
  return (
    roles.find((r) => r.role === RoleKey.FORMER_STUDENT)
      ?.graduationOrLeaveYear ?? null
  );
}

/**
 * Follow-button state, Instagram-style:
 * - following:  my follow is ACCEPTED (「フォロー中」, unfollow with a confirm)
 * - requested:  my request is pending (「リクエスト済み」, cancels)
 * - followBack: I don't follow them but they follow me (「フォローバック」)
 * - none:       neither (「フォローする」)
 * A follow-back still sends a normal request (auto-accept rules apply as
 * usual), so their privacy is kept.
 */
export type FollowUiState = "none" | "followBack" | "requested" | "following";

/**
 * Map (my follow of them, their follow of me) to a button state. `canRequest`
 * is `canRequestFollow(...).ok`; when I have no follow row and may not send
 * one (minor, inactive, blocked, family…) there is no button (null).
 */
export function followButtonState(
  mine: FollowStatus | null,
  theirs: FollowStatus | null,
  canRequest = true,
): FollowUiState | null {
  if (mine === FollowStatus.ACCEPTED) return "following";
  if (mine === FollowStatus.REQUESTED) return "requested";
  if (!canRequest) return null;
  return theirs === FollowStatus.ACCEPTED ? "followBack" : "none";
}

/** They follow me (accepted); shown as 「フォローされています」. */
export function followsMe(theirs: FollowStatus | null): boolean {
  return theirs === FollowStatus.ACCEPTED;
}

export type FollowRequestResult =
  | { ok: true; status: FollowStatus }
  | { ok: false; reason: FollowDenial | "rateLimited" | "notFound" };

async function safeNotify(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    // A failed LINE/email send must not undo the follow change.
    console.error("[follows] notification failed", e);
  }
}

export async function requestFollow(
  viewer: CurrentUser,
  targetId: string,
  now: Date = new Date(),
): Promise<FollowRequestResult> {
  const target = await db.user.findUnique({
    where: { id: targetId },
    include: { roles: true },
  });
  if (!target) return { ok: false, reason: "notFound" };
  const rel = await loadRelationship(viewer.id, target.id);
  const check = canRequestFollow(toViewer(viewer), toTarget(target), rel, now);
  if (!check.ok) return check;

  const recent = await db.follow.count({
    where: {
      followerId: viewer.id,
      createdAt: { gte: followRateWindowStart(now) },
    },
  });
  if (isFollowRateLimited(recent)) return { ok: false, reason: "rateLimited" };

  const status = shouldAutoAccept(
    {
      autoAcceptSameYear: target.autoAcceptSameYear,
      graduationYear: formerStudentYear(target.roles),
    },
    { graduationYear: formerStudentYear(viewer.roles) },
  )
    ? FollowStatus.ACCEPTED
    : FollowStatus.REQUESTED;

  let followId: string;
  try {
    const f = await db.follow.create({
      data: { followerId: viewer.id, followeeId: target.id, status },
      select: { id: true },
    });
    followId = f.id;
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, reason: "already" };
    }
    throw e;
  }

  await safeNotify(async () => {
    const to = await db.user.findUniqueOrThrow({
      where: { id: target.id },
      select: NOTIFY_USER_SELECT,
    });
    const auto = status === FollowStatus.ACCEPTED;
    await notify(to, {
      kind: auto ? "FOLLOW_AUTO_ACCEPTED" : "FOLLOW_REQUEST",
      refId: followId,
      path: `/app/follows?tab=${auto ? "followers" : "incoming"}`,
      params: (locale) => ({ name: displayName(viewer, locale) }),
    });
  });

  return { ok: true, status };
}

/** Accept an incoming request addressed to `me`. */
export async function acceptFollow(
  me: CurrentUser,
  followId: string,
): Promise<boolean> {
  const res = await db.follow.updateMany({
    where: { id: followId, followeeId: me.id, status: FollowStatus.REQUESTED },
    data: { status: FollowStatus.ACCEPTED },
  });
  if (res.count === 0) return false;
  await safeNotify(async () => {
    const follow = await db.follow.findUniqueOrThrow({
      where: { id: followId },
      select: { follower: { select: NOTIFY_USER_SELECT } },
    });
    await notify(follow.follower, {
      kind: "FOLLOW_ACCEPTED",
      refId: followId,
      path: `/app/members/${me.id}`,
      params: (locale) => ({ name: displayName(me, locale) }),
    });
  });
  return true;
}

/** Decline (delete) an incoming request. */
export async function declineFollow(me: CurrentUser, followId: string) {
  await db.follow.deleteMany({
    where: { id: followId, followeeId: me.id, status: FollowStatus.REQUESTED },
  });
}

/** Remove an accepted follower of mine. */
export async function removeFollower(me: CurrentUser, followerId: string) {
  await db.follow.deleteMany({
    where: { followerId, followeeId: me.id },
  });
}

/** Unfollow, or cancel my pending request (same row either way). */
export async function unfollow(me: CurrentUser, targetId: string) {
  await db.follow.deleteMany({
    where: { followerId: me.id, followeeId: targetId },
  });
}

/** Block: create the Block and drop follows in both directions (§9.2). */
export async function blockUser(
  me: CurrentUser,
  targetId: string,
): Promise<boolean> {
  if (targetId === me.id) return false;
  const exists = await db.user.findUnique({
    where: { id: targetId },
    select: { id: true },
  });
  if (!exists) return false;
  await db.$transaction([
    db.block.upsert({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: targetId } },
      create: { blockerId: me.id, blockedId: targetId },
      update: {},
    }),
    db.follow.deleteMany({
      where: {
        OR: [
          { followerId: me.id, followeeId: targetId },
          { followerId: targetId, followeeId: me.id },
        ],
      },
    }),
  ]);
  return true;
}

export async function unblockUser(me: CurrentUser, targetId: string) {
  await db.block.deleteMany({
    where: { blockerId: me.id, blockedId: targetId },
  });
}

/** Everything the /follows page shows, public-tier columns only. */
export async function loadFollowLists(meId: string) {
  const [incoming, outgoing, followers, following, blocked] = await Promise.all(
    [
      db.follow.findMany({
        where: { followeeId: meId, status: FollowStatus.REQUESTED },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          follower: { select: PUBLIC_CARD_SELECT },
        },
      }),
      db.follow.findMany({
        where: { followerId: meId, status: FollowStatus.REQUESTED },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          followee: { select: PUBLIC_CARD_SELECT },
        },
      }),
      db.follow.findMany({
        where: { followeeId: meId, status: FollowStatus.ACCEPTED },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          follower: { select: PUBLIC_CARD_SELECT },
        },
      }),
      db.follow.findMany({
        where: { followerId: meId, status: FollowStatus.ACCEPTED },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          followee: { select: PUBLIC_CARD_SELECT },
        },
      }),
      db.block.findMany({
        where: { blockerId: meId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          blocked: { select: PUBLIC_CARD_SELECT },
        },
      }),
    ],
  );
  return { incoming, outgoing, followers, following, blocked };
}

export type FollowLists = Awaited<ReturnType<typeof loadFollowLists>>;

/** Status of the follow row follower → followee, if any. */
export async function loadFollowStatus(
  followerId: string,
  followeeId: string,
): Promise<FollowStatus | null> {
  if (followerId === followeeId) return null;
  const f = await db.follow.findUnique({
    where: { followerId_followeeId: { followerId, followeeId } },
    select: { status: true },
  });
  return f?.status ?? null;
}

/** Instagram-style counts: accepted follows only. */
export async function loadFollowCounts(
  userId: string,
): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    db.follow.count({
      where: { followeeId: userId, status: FollowStatus.ACCEPTED },
    }),
    db.follow.count({
      where: { followerId: userId, status: FollowStatus.ACCEPTED },
    }),
  ]);
  return { followers, following };
}

/**
 * My follow-button state toward each of `ids` (null = no button), applying
 * the same rules as requestFollow: blocks, family, minors / parent-managed
 * accounts and inactive accounts.
 */
export async function loadFollowButtonStates(
  me: CurrentUser,
  ids: readonly string[],
  now: Date = new Date(),
): Promise<Map<string, FollowUiState | null>> {
  const out = new Map<string, FollowUiState | null>();
  const others = [...new Set(ids)].filter((id) => id !== me.id);
  if (others.length === 0) return out;
  const [users, mine, theirs, blocks] = await Promise.all([
    db.user.findMany({
      where: { id: { in: others } },
      select: {
        id: true,
        state: true,
        familyId: true,
        dateOfBirth: true,
        managedById: true,
        roles: { select: { role: true } },
      },
    }),
    db.follow.findMany({
      where: { followerId: me.id, followeeId: { in: others } },
      select: { followeeId: true, status: true },
    }),
    db.follow.findMany({
      where: { followeeId: me.id, followerId: { in: others } },
      select: { followerId: true, status: true },
    }),
    db.block.findMany({
      where: {
        OR: [
          { blockerId: me.id, blockedId: { in: others } },
          { blockedId: me.id, blockerId: { in: others } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
  ]);
  const mineBy = new Map(mine.map((f) => [f.followeeId, f.status]));
  const theirsBy = new Map(theirs.map((f) => [f.followerId, f.status]));
  const blocked = new Set(
    blocks.map((b) => (b.blockerId === me.id ? b.blockedId : b.blockerId)),
  );
  const viewer = toViewer(me);
  for (const u of users) {
    const isBlocked = blocked.has(u.id);
    if (isBlocked || sameFamily(me, u)) {
      out.set(u.id, null);
      continue;
    }
    const rel = { follow: mineBy.get(u.id) ?? null, blocked: isBlocked };
    const check = canRequestFollow(
      viewer,
      {
        id: u.id,
        state: u.state,
        roles: u.roles.map((r) => r.role),
        dateOfBirth: u.dateOfBirth,
        familyId: u.familyId,
        managed: u.managedById !== null,
      },
      rel,
      now,
    );
    out.set(
      u.id,
      followButtonState(rel.follow, theirsBy.get(u.id) ?? null, check.ok),
    );
  }
  return out;
}

/** A follow of mine I just accepted, for the inline follow-back offer. */
export async function loadAcceptedFollower(meId: string, followId: string) {
  const f = await db.follow.findFirst({
    where: { id: followId, followeeId: meId, status: FollowStatus.ACCEPTED },
    select: { follower: { select: PUBLIC_CARD_SELECT } },
  });
  return f?.follower ?? null;
}
