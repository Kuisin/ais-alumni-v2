import { AccountState, RoleKey } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import type { CurrentUser } from "@/server/lib/session";
import { type SetupItem, setupChecklist } from "@/server/lib/setup";
import { ssoReady } from "@/server/lib/sso";

/** Checklist items for the signed-in member. */
export async function loadSetupChecklist(
  user: CurrentUser,
): Promise<SetupItem[]> {
  const [request, education, work, follows, links] = await Promise.all([
    db.verificationRequest.findUnique({
      where: { userId: user.id },
      select: { id: true },
    }),
    db.educationEntry.count({ where: { userId: user.id } }),
    db.workEntry.count({ where: { userId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    db.familyLink.count({
      where: { OR: [{ parentId: user.id }, { childId: user.id }] },
    }),
  ]);
  return setupChecklist({
    active: user.state === AccountState.ACTIVE,
    // Admin-created or seeded accounts may be active without an application.
    submitted: request !== null || user.state === AccountState.ACTIVE,
    lineAvailable: ssoReady("line"),
    lineLinked: Boolean(user.lineUserId),
    lineFollowing: user.lineFollowing,
    hasAvatar: Boolean(user.avatarUrl),
    hasBio: Boolean(user.bio?.trim()),
    hasHistory: education + work > 0,
    followsSomeone: follows > 0,
    isParent: user.roles.some(
      (r) =>
        r.role === RoleKey.CURRENT_PARENT || r.role === RoleKey.FORMER_PARENT,
    ),
    hasFamilyLink: links > 0,
    hasKanjiName: Boolean(user.nameKanji?.trim() && user.nameKana?.trim()),
    currentTeacher: user.roles.some(
      (r) => r.role === RoleKey.TEACHER && r.teacherStatus !== "FORMER",
    ),
    schoolEmailVerified: user.roles.some(
      (r) =>
        r.role === RoleKey.TEACHER &&
        Boolean(r.schoolEmail) &&
        r.schoolEmailVerified,
    ),
  });
}
