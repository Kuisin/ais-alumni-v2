import type { Prisma } from "@/server/generated/prisma/client";
import { RoleKey } from "@/server/generated/prisma/enums";
import { syncChatMembership } from "@/server/lib/chat-db";
import { db } from "@/server/lib/db";
import {
  childIsCurrent,
  PARENT_ROLES,
  parentRole,
  STUDENT_ROLES,
  studentRoleFields,
  teacherFields,
} from "@/server/lib/member-status";
import { syncStageFromHistory } from "@/server/lib/stage";

type Client = Prisma.TransactionClient | typeof db;

/**
 * Recompute a member's automatic statuses (§ current/former, grade,
 * graduation) from their 学年 and leave years, and their children's for
 * parents, then their group chats. Called after any save and daily by the "sync-status" job (src/lib/jobs), so
 * people move from current to former (and up a grade) on their own.
 * Returns true if anything changed.
 */
export async function syncMemberStatus(
  userId: string,
  client: Client = db,
  now: Date = new Date(),
): Promise<boolean> {
  const roles = await client.userRole.findMany({
    where: { userId },
    include: { cohort: { select: { elementaryEndYear: true } } },
  });
  let changed = false;

  for (const r of roles) {
    if (STUDENT_ROLES.includes(r.role) && r.cohort) {
      // yearsTo holds the year they left early (null = stayed / still there).
      const f = studentRoleFields(
        r.cohort.elementaryEndYear,
        r.yearsFrom,
        r.yearsTo,
        now,
      );
      const { role, ...fields } = f;
      const differs =
        role !== r.role ||
        fields.graduationOrLeaveYear !== r.graduationOrLeaveYear ||
        fields.didGraduate !== r.didGraduate ||
        fields.lastDivision !== r.lastDivision ||
        fields.currentGrade !== r.currentGrade;
      if (differs) {
        if (role !== r.role) {
          // (userId, role) is unique: drop a stale row of the target role.
          await client.userRole.deleteMany({ where: { userId, role } });
        }
        await client.userRole.update({
          where: { id: r.id },
          data: { role, ...fields },
        });
        changed = true;
      }
    } else if (r.role === RoleKey.TEACHER) {
      const f = teacherFields(r.yearsFrom, r.yearsTo, now);
      if (f.teacherStatus !== r.teacherStatus) {
        await client.userRole.update({
          where: { id: r.id },
          data: { teacherStatus: f.teacherStatus },
        });
        changed = true;
      }
    }
  }

  const parentRow = roles.find((r) => PARENT_ROLES.includes(r.role));
  if (parentRow) {
    const links = await client.familyLink.findMany({
      where: { parentId: userId },
      select: {
        childLeftYear: true,
        childCohort: { select: { elementaryEndYear: true } },
        child: {
          select: {
            roles: {
              where: { role: { in: [...STUDENT_ROLES] } },
              select: {
                yearsTo: true,
                cohort: { select: { elementaryEndYear: true } },
              },
            },
          },
        },
      },
    });
    const statuses: boolean[] = [];
    for (const l of links) {
      // Prefer the child's own record when they have an account.
      const own = l.child?.roles.find((cr) => cr.cohort);
      if (own?.cohort)
        statuses.push(
          childIsCurrent(own.cohort.elementaryEndYear, own.yearsTo, now),
        );
      else if (l.childCohort)
        statuses.push(
          childIsCurrent(l.childCohort.elementaryEndYear, l.childLeftYear, now),
        );
    }
    if (statuses.length) {
      const role = parentRole(statuses);
      if (role !== parentRow.role) {
        await client.userRole.deleteMany({ where: { userId, role } });
        await client.userRole.update({
          where: { id: parentRow.id },
          data: { role },
        });
        changed = true;
      }
    }
  }
  // 現在の状況 follows 学歴・職歴 (e.g. a school's end year has passed).
  if (await syncStageFromHistory(userId, client, now)) changed = true;
  // Group chats follow type, 学年 and state (e.g. just approved).
  await syncChatMembership(userId, client, now);
  return changed;
}

/**
 * Every member with a student, teacher or parent role, in id order (the
 * daily sync-status job goes through them with syncMemberStatus).
 */
export async function statusSyncUserIds(): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      roles: {
        some: {
          role: { in: [...STUDENT_ROLES, ...PARENT_ROLES, RoleKey.TEACHER] },
        },
      },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return users.map((u) => u.id);
}
