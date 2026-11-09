import type { AccessPosition, AccessType, MyAccess } from "@contract/core";
import { RoleKey, TeacherStatus } from "@/server/generated/prisma/enums";
import { directoryAllowed } from "@/server/lib/authz";
import { isMinor } from "@/server/lib/authz/core";
import { loadDirectRules } from "@/server/lib/chat-db";
import { cohortShort } from "@/server/lib/cohorts";
import { db } from "@/server/lib/db";
import type { CurrentUser } from "@/server/lib/session";

const POSITIONS: readonly AccessPosition[] = [
  "ALUMNI_COMMITTEE",
  "STUDENT_LEADER",
  "TEACHER_REGISTRAR",
  "TEACHER_MANAGER",
];

/** The member's types as the page lists them. */
function typesOf(roles: CurrentUser["roles"]): AccessType[] {
  const out = new Set<AccessType>();
  for (const r of roles) {
    if (r.role === RoleKey.TEACHER)
      out.add(
        r.teacherStatus === TeacherStatus.FORMER
          ? "TEACHER_FORMER"
          : "TEACHER_CURRENT",
      );
    else if (r.role === RoleKey.FORMER_STUDENT) {
      if (r.didGraduate !== false) out.add("GRADUATE");
      if (r.didGraduate !== true) out.add("LEFT_STUDENT");
    } else out.add(r.role);
  }
  return [...out];
}

/**
 * 利用できる機能 (マイページ): what the member is and what that lets them
 * use — the same rules the server applies (authz, direct-policy,
 * permissions), read here only to show them.
 */
export async function myAccess(
  user: CurrentUser,
  locale: "ja" | "en",
): Promise<MyAccess> {
  const [positions, rules] = await Promise.all([
    db.userPosition.findMany({
      where: { userId: user.id },
      select: { position: true, cohort: { select: { number: true } } },
    }),
    loadDirectRules(),
  ]);
  return {
    types: typesOf(user.roles),
    positions: positions
      .filter((p) => POSITIONS.includes(p.position as AccessPosition))
      .map((p) => ({
        key: p.position as AccessPosition,
        cohort: p.cohort ? cohortShort(p.cohort, locale) : null,
      })),
    minor: isMinor({
      roles: user.roles.map((r) => r.role),
      dateOfBirth: user.dateOfBirth,
      managed: user.managedById !== null,
    }),
    directory: directoryAllowed(user),
    directRules: {
      CURRENT_STUDENT: rules.CURRENT_STUDENT,
      FORMER_STUDENT: rules.FORMER_STUDENT,
      CURRENT_PARENT: rules.CURRENT_PARENT,
      FORMER_PARENT: rules.FORMER_PARENT,
    },
  };
}
