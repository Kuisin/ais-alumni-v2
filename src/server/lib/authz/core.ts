import {
  AccountState,
  type AudienceKey,
  FollowStatus,
  RoleKey,
} from "@/server/generated/prisma/enums";

/**
 * Pure authorization rules (§8, §9, §10.1). No database access here so the
 * rules are unit-testable; src/lib/authz/index.ts loads the inputs.
 */

export type Viewer = {
  id: string;
  state: AccountState;
  isAdmin: boolean;
  roles: readonly RoleKey[];
  /** TEACHER role with status 現職; former teachers get no teacher access. */
  currentTeacher: boolean;
  familyId: string | null;
  /** roles with 卒業生 / 元在校生 split (src/lib/audience.ts) */
  audiences?: readonly AudienceKey[];
};

export type Target = {
  id: string;
  state: AccountState;
  roles: readonly RoleKey[];
  dateOfBirth: Date | null;
  familyId: string | null;
  /** child account managed by a parent (no sign-in of its own) */
  managed?: boolean;
};

export type Relationship = {
  /** viewer → target follow status, if any */
  follow: FollowStatus | null;
  /** true if either party has blocked the other */
  blocked: boolean;
};

export const ADULT_AGE = 18;

export function ageOn(dateOfBirth: Date, now: Date): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const m = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) age--;
  return age;
}

/** Minor = CURRENT_STUDENT role, or DOB less than 18 years ago (§8). */
export function isMinor(
  target: Pick<Target, "roles" | "dateOfBirth" | "managed">,
  now: Date = new Date(),
): boolean {
  if (target.roles.includes(RoleKey.CURRENT_STUDENT)) return true;
  // Parent-managed child accounts get the same protection until the child
  // takes the account over.
  if (target.managed) return true;
  if (target.dateOfBirth && ageOn(target.dateOfBirth, now) < ADULT_AGE)
    return true;
  return false;
}

export function sameFamily(
  a: { familyId: string | null },
  b: { familyId: string | null },
): boolean {
  return a.familyId !== null && a.familyId === b.familyId;
}

function viewerIsActive(viewer: Viewer): boolean {
  return viewer.state === AccountState.ACTIVE;
}

/** Can the viewer see the target at all (profile page, public tier)? */
export function canViewProfile(
  viewer: Viewer,
  target: Target,
  rel: Relationship,
  now: Date = new Date(),
): boolean {
  if (viewer.id === target.id) return true;
  if (!viewerIsActive(viewer)) return false;
  if (viewer.isAdmin) return true;
  if (target.state !== AccountState.ACTIVE) return false;
  if (rel.blocked) return false;
  if (isMinor(target, now)) {
    return sameFamily(viewer, target) || viewer.currentTeacher;
  }
  return true;
}

/** Directory inclusion uses the same rule as profile visibility (§10.1). */
export const canSeeInDirectory = canViewProfile;

/**
 * THE single gate for private-tier fields (§9.1, §15):
 *  - "all": self, admins and family members see every personal field;
 *  - "followers": accepted followers see only the fields the member chose
 *    to share with followers (User.followerFields, all off by default);
 *  - "none": everyone else.
 */
export type PrivateAccess = "all" | "followers" | "none";

export function privateAccess(
  viewer: Viewer,
  target: Target,
  rel: Relationship,
  now: Date = new Date(),
): PrivateAccess {
  if (viewer.id === target.id) return "all";
  if (!viewerIsActive(viewer)) return "none";
  if (viewer.isAdmin) return "all";
  if (!canViewProfile(viewer, target, rel, now)) return "none";
  if (sameFamily(viewer, target)) return "all";
  return rel.follow === FollowStatus.ACCEPTED ? "followers" : "none";
}

/**
 * Followers-or-family tier: "followers only" 学歴・職歴 entries. Personal
 * fields use privateAccess() instead.
 */
export function canViewPrivate(
  viewer: Viewer,
  target: Target,
  rel: Relationship,
  now: Date = new Date(),
): boolean {
  return privateAccess(viewer, target, rel, now) !== "none";
}

export type FollowDenial =
  | "self"
  | "inactive"
  | "blocked"
  | "minor"
  | "already"
  | "family";

/** Can the viewer send a follow request to the target? (§8, §9.2) */
export function canRequestFollow(
  viewer: Viewer,
  target: Target,
  rel: Relationship,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: FollowDenial } {
  if (viewer.id === target.id) return { ok: false, reason: "self" };
  if (!viewerIsActive(viewer) || target.state !== AccountState.ACTIVE)
    return { ok: false, reason: "inactive" };
  if (rel.blocked) return { ok: false, reason: "blocked" };
  // Family members already have following status with each other.
  if (sameFamily(viewer, target)) return { ok: false, reason: "family" };
  if (rel.follow) return { ok: false, reason: "already" };
  if (isMinor(target, now) && !viewer.currentTeacher)
    return { ok: false, reason: "minor" };
  return { ok: true };
}

/**
 * "Auto-accept follow requests from my graduation year ±1" (§9.2). Uses the
 * FORMER_STUDENT graduation/leave year of both parties.
 */
export function shouldAutoAccept(
  target: { autoAcceptSameYear: boolean; graduationYear: number | null },
  follower: { graduationYear: number | null },
): boolean {
  if (!target.autoAcceptSameYear) return false;
  if (target.graduationYear === null || follower.graduationYear === null)
    return false;
  return Math.abs(target.graduationYear - follower.graduationYear) <= 1;
}

/** Content targeting for events and news: empty list = everyone (§10.3, §10.4). */
export function isTargeted(
  targetRoles: readonly RoleKey[],
  viewer: Pick<Viewer, "roles" | "isAdmin">,
): boolean {
  if (viewer.isAdmin || targetRoles.length === 0) return true;
  return targetRoles.some((r) => viewer.roles.includes(r));
}
