import type { Prisma } from "@/server/generated/prisma/client";
import { RoleKey, TeacherStatus } from "@/server/generated/prisma/enums";
import { audiencesOfMember } from "@/server/lib/audience";
import { db } from "@/server/lib/db";
import {
  followerFieldSet,
  isPersonalField,
  type PersonalField,
} from "@/server/lib/personal-fields";
import { hiddenPersonalFields } from "@/server/lib/profile-visibility";
import {
  canViewPrivate as canViewPrivateCore,
  canViewProfile,
  type PrivateAccess,
  privateAccess,
  type Relationship,
  type Target,
  type Viewer,
} from "./core";

export * from "./core";

type UserWithRoles = Prisma.UserGetPayload<{ include: { roles: true } }>;

export function toViewer(user: UserWithRoles): Viewer {
  return {
    id: user.id,
    state: user.state,
    isAdmin: user.isAdmin,
    roles: user.roles.map((r) => r.role),
    currentTeacher: isCurrentTeacher(user.roles),
    familyId: user.familyId,
    audiences: audiencesOfMember(user.roles),
  };
}

/** Has the TEACHER role with status 現職 (unset counts as current). */
export function isCurrentTeacher(
  roles: readonly { role: RoleKey; teacherStatus: TeacherStatus | null }[],
): boolean {
  return roles.some(
    (r) =>
      r.role === RoleKey.TEACHER && r.teacherStatus !== TeacherStatus.FORMER,
  );
}

export const toTarget: (user: UserWithRoles) => Target = (user) => ({
  id: user.id,
  state: user.state,
  roles: user.roles.map((r) => r.role),
  dateOfBirth: user.dateOfBirth,
  familyId: user.familyId,
  managed: user.managedById !== null,
});

export async function loadRelationship(
  viewerId: string,
  targetId: string,
): Promise<Relationship> {
  if (viewerId === targetId) return { follow: null, blocked: false };
  const [follow, block] = await Promise.all([
    db.follow.findUnique({
      where: {
        followerId_followeeId: { followerId: viewerId, followeeId: targetId },
      },
      select: { status: true },
    }),
    db.block.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: targetId },
          { blockerId: targetId, blockedId: viewerId },
        ],
      },
      select: { id: true },
    }),
  ]);
  return { follow: follow?.status ?? null, blocked: block !== null };
}

/** IDs hidden from the viewer because of a block in either direction. */
export async function blockedUserIds(viewerId: string): Promise<string[]> {
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((b) =>
    b.blockerId === viewerId ? b.blockedId : b.blockerId,
  );
}

/** DB-backed wrapper for the single private-tier gate (§15). */
export async function canViewPrivate(
  viewer: UserWithRoles,
  target: UserWithRoles,
): Promise<boolean> {
  const rel = await loadRelationship(viewer.id, target.id);
  return canViewPrivateCore(toViewer(viewer), toTarget(target), rel);
}

export type PublicProfile = {
  id: string;
  nameRomaji: string | null;
  nameKanji: string | null;
  nameKana: string | null;
  nameAtAis: string | null;
  avatarUrl: string | null;
  avatarPublic: boolean;
  gender: string | null;
  bio: string | null;
  roles: {
    role: RoleKey;
    yearsFrom: number | null;
    yearsTo: number | null;
    lastDivision: UserWithRoles["roles"][number]["lastDivision"];
    graduationOrLeaveYear: number | null;
    didGraduate: boolean | null;
    currentStage: UserWithRoles["roles"][number]["currentStage"];
    currentGrade: number | null;
    subjects: string | null;
    cohortId: string | null;
    teacherStatus: TeacherStatus | null;
  }[];
};

export type PrivateProfile = {
  email: string | null;
  phone: string | null;
  lineDisplayName: string | null;
  currentStageDetail: string | null;
  socialLinks: Prisma.JsonValue | null;
};

export type ProfileView = {
  public: PublicProfile;
  /**
   * Personal fields the viewer may see (privateAccess): all of them for
   * self / family / admins, only the shared ones for followers (others
   * null); null for everyone else.
   */
  private: PrivateProfile | null;
  access: PrivateAccess;
  /** personal fields kept from the viewer (shown as 非公開, never the value) */
  hiddenFields: PersonalField[];
  /** the member shares at least one field with followers */
  sharesWithFollowers: boolean;
  relationship: Relationship;
  isSelf: boolean;
};

export function projectPublic(user: UserWithRoles): PublicProfile {
  return {
    id: user.id,
    nameRomaji: user.nameRomaji,
    nameKanji: user.nameKanji,
    nameKana: user.nameKana,
    nameAtAis: user.nameAtAis,
    avatarUrl: user.avatarUrl,
    avatarPublic: user.avatarPublic,
    gender: user.gender,
    bio: user.bio,
    roles: user.roles.map((r) => ({
      role: r.role,
      yearsFrom: r.yearsFrom,
      yearsTo: r.yearsTo,
      lastDivision: r.lastDivision,
      graduationOrLeaveYear: r.graduationOrLeaveYear,
      didGraduate: r.didGraduate,
      currentStage: r.currentStage,
      currentGrade: r.currentGrade,
      subjects: r.subjects,
      cohortId: r.cohortId,
      teacherStatus: r.teacherStatus,
    })),
  };
}

export function projectPrivate(
  user: UserWithRoles,
  access: PrivateAccess,
): PrivateProfile | null {
  if (access === "none") return null;
  const shared = followerFieldSet(user.followerFields);
  // A follower of a member who shares nothing: same as no access.
  if (access === "followers" && shared.size === 0) return null;
  const show = (f: PersonalField) => access === "all" || shared.has(f);
  const social = (
    user.socialLinks && typeof user.socialLinks === "object"
      ? user.socialLinks
      : {}
  ) as Record<string, unknown>;
  const socialShown = Object.fromEntries(
    Object.entries(social).filter(
      ([k]) => isPersonalField(k) && show(k as PersonalField),
    ),
  );
  return {
    email: show("email") ? user.primaryEmail : null,
    phone: show("phone") ? user.phone : null,
    lineDisplayName: show("lineDisplayName") ? user.lineDisplayName : null,
    currentStageDetail: show("currentStageDetail")
      ? (user.roles.find((r) => r.role === RoleKey.FORMER_STUDENT)
          ?.currentStageDetail ?? null)
      : null,
    socialLinks: Object.keys(socialShown).length
      ? (socialShown as Prisma.JsonValue)
      : null,
  };
}

/**
 * Load another member's profile as the viewer is allowed to see it. Returns
 * null if the viewer may not see the target at all. All profile reads for
 * display MUST go through here so private fields are never leaked.
 */
export async function getProfileForViewer(
  viewer: UserWithRoles,
  targetId: string,
): Promise<ProfileView | null> {
  const target = await db.user.findUnique({
    where: { id: targetId },
    include: { roles: true },
  });
  if (!target) return null;
  const rel = await loadRelationship(viewer.id, target.id);
  const v = toViewer(viewer);
  const t = toTarget(target);
  if (!canViewProfile(v, t, rel)) return null;
  const access = privateAccess(v, t, rel);
  return {
    public: projectPublic(target),
    private: projectPrivate(target, access),
    access,
    hiddenFields: hiddenPersonalFields(
      access,
      followerFieldSet(target.followerFields),
    ),
    sharesWithFollowers: followerFieldSet(target.followerFields).size > 0,
    relationship: rel,
    isSelf: viewer.id === target.id,
  };
}
