import { Division } from "@/server/generated/prisma/enums";

/**
 * AIS school calendar and automatic statuses (pure; unit-tested).
 *
 * - The school year runs April → March (Japan time). "School year 2026" is
 *   April 2026 – March 2027.
 * - AIS has kindergarten (年少 / 年中 / 年長) and elementary (grades 1–6).
 *   Finishing 6th grade is graduating from AIS.
 * - A 学年 (class) is identified by the calendar year its 6th grade ends
 *   (March of `elementaryEndYear`); 2016 = 第5期.
 * - Leave years are calendar years ("left AIS in 2014").
 */

/** Divisions AIS has (JUNIOR_HIGH / HIGH_SCHOOL are deprecated enum values). */
export const AIS_DIVISIONS = [
  Division.KINDERGARTEN,
  Division.ELEMENTARY,
] as const;

/** Grade numbers: 1–6 elementary, 0 年長, -1 年中, -2 年少. */
export const YOUNGEST_GRADE = -2;
export const FINAL_GRADE = 6;

function jst(now: Date): Date {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

/** Calendar year in which the current school year started (April). */
export function schoolYearStart(now: Date = new Date()): number {
  const d = jst(now);
  return d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

export function calendarYear(now: Date = new Date()): number {
  return jst(now).getUTCFullYear();
}

/** Grade of a class during the school year that starts in April `schoolYear`. */
export function gradeInSchoolYear(
  elementaryEndYear: number,
  schoolYear: number,
): number {
  return schoolYear + 7 - elementaryEndYear;
}

/** A class has graduated once the March its 6th grade ends is in the past. */
export function isClassGraduated(
  elementaryEndYear: number,
  now: Date = new Date(),
): boolean {
  return schoolYearStart(now) >= elementaryEndYear;
}

/** Current grade of a class, or null if it has graduated or not started yet. */
export function classGradeNow(
  elementaryEndYear: number,
  now: Date = new Date(),
): number | null {
  const g = gradeInSchoolYear(elementaryEndYear, schoolYearStart(now));
  return g >= YOUNGEST_GRADE && g <= FINAL_GRADE ? g : null;
}

/** 6th-grade end year of the class that is in `grade` this school year. */
export function elementaryEndForGrade(
  grade: number,
  now: Date = new Date(),
): number {
  return schoolYearStart(now) + 7 - grade;
}

export type StudentStatus = {
  current: boolean;
  didGraduate: boolean;
  /** graduation year, or the year they left early */
  graduationOrLeaveYear: number | null;
  lastDivision: Division | null;
  /** only for current students */
  currentGrade: number | null;
};

/**
 * Status of a student from their class and (optional) year they left AIS.
 * Leaving in or after the class's graduation year counts as graduating.
 */
export function studentStatus(
  elementaryEndYear: number,
  leftYear: number | null,
  now: Date = new Date(),
): StudentStatus {
  const leftEarly =
    leftYear !== null &&
    leftYear < elementaryEndYear &&
    leftYear <= calendarYear(now);
  if (leftEarly) {
    // Grade during their last school year at AIS (the one ending in March
    // of the year they left, or the one they left during).
    const lastGrade = gradeInSchoolYear(elementaryEndYear, leftYear - 1);
    return {
      current: false,
      didGraduate: false,
      graduationOrLeaveYear: leftYear,
      lastDivision:
        lastGrade <= 0 ? Division.KINDERGARTEN : Division.ELEMENTARY,
      currentGrade: null,
    };
  }
  if (isClassGraduated(elementaryEndYear, now)) {
    return {
      current: false,
      didGraduate: true,
      graduationOrLeaveYear: elementaryEndYear,
      lastDivision: Division.ELEMENTARY,
      currentGrade: null,
    };
  }
  const grade = classGradeNow(elementaryEndYear, now);
  return {
    current: true,
    didGraduate: false,
    graduationOrLeaveYear: null,
    lastDivision:
      grade !== null && grade <= 0
        ? Division.KINDERGARTEN
        : Division.ELEMENTARY,
    currentGrade: grade,
  };
}

/** A teacher is current until the year they leave has arrived. */
export function isCurrentTeacher(
  leftYear: number | null,
  now: Date = new Date(),
): boolean {
  return leftYear === null || leftYear > calendarYear(now);
}
