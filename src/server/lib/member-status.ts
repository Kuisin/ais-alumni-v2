import { RoleKey, TeacherStatus } from "@/server/generated/prisma/enums";
import { isCurrentTeacher, studentStatus } from "@/server/lib/school";

/**
 * What a member entered (学年, joined / left years) → their actual role and
 * the computed record fields. Pure; used when saving and by the daily sync.
 */

export const STUDENT_ROLES: readonly RoleKey[] = [
  RoleKey.CURRENT_STUDENT,
  RoleKey.FORMER_STUDENT,
];
export const PARENT_ROLES: readonly RoleKey[] = [
  RoleKey.CURRENT_PARENT,
  RoleKey.FORMER_PARENT,
];

export function studentRoleFields(
  elementaryEndYear: number,
  joinedYear: number | null,
  leftYear: number | null,
  now: Date = new Date(),
) {
  const st = studentStatus(elementaryEndYear, leftYear, now);
  return {
    role: st.current ? RoleKey.CURRENT_STUDENT : RoleKey.FORMER_STUDENT,
    yearsFrom: joinedYear,
    // The year they left early (null if still at AIS or graduated).
    yearsTo:
      leftYear !== null && leftYear < elementaryEndYear ? leftYear : null,
    graduationOrLeaveYear: st.graduationOrLeaveYear,
    didGraduate: st.current ? null : st.didGraduate,
    lastDivision: st.lastDivision,
    currentGrade: st.currentGrade,
  };
}

export function teacherFields(
  joinedYear: number | null,
  leftYear: number | null,
  now: Date = new Date(),
) {
  return {
    yearsFrom: joinedYear,
    yearsTo: leftYear,
    teacherStatus: isCurrentTeacher(leftYear, now)
      ? TeacherStatus.CURRENT
      : TeacherStatus.FORMER,
  };
}

/** A parent is current while any of their children is a current student. */
export function parentRole(childIsCurrent: readonly boolean[]): RoleKey {
  return childIsCurrent.some(Boolean)
    ? RoleKey.CURRENT_PARENT
    : RoleKey.FORMER_PARENT;
}

export function childIsCurrent(
  elementaryEndYear: number,
  leftYear: number | null,
  now: Date = new Date(),
) {
  return studentStatus(elementaryEndYear, leftYear, now).current;
}
