import {
  classGradeNow,
  elementaryEndForGrade,
  isClassGraduated,
  YOUNGEST_GRADE,
} from "@/server/lib/school";

/**
 * 学年 (classes). Numbered 第N期 by the year the class finishes 6th grade
 * (graduates from AIS): 2016 = 第5期, so 第1期 finished in 2012. Rows are
 * created on first use (ensureCohort); grade and graduation are computed.
 */
export const FIRST_COHORT_ELEMENTARY_END = 2012;

export function cohortNumberFor(elementaryEndYear: number): number {
  return elementaryEndYear - FIRST_COHORT_ELEMENTARY_END + 1;
}

export function elementaryEndFor(number: number): number {
  return FIRST_COHORT_ELEMENTARY_END + number - 1;
}

/** Elementary start (1st grade, April): six school years before the end. */
export function suggestedStartYear(elementaryEndYear: number): number {
  return elementaryEndYear - 6;
}

/** Newest class at AIS: this year's 年少 (youngest kindergarten year). */
export function latestCohortNumber(now: Date = new Date()): number {
  return cohortNumberFor(elementaryEndForGrade(YOUNGEST_GRADE, now));
}

export type CohortLike = {
  id: string;
  number: number;
  elementaryStartYear: number;
  elementaryEndYear: number;
};

/** "小学3年生" / "年長"; English "Grade 3" / "Kindergarten (year 3)". */
export function gradeLabel(grade: number, locale: "ja" | "en"): string {
  if (grade >= 1)
    return locale === "ja" ? `小学${grade}年生` : `Grade ${grade}`;
  const k = ["年少", "年中", "年長"][grade + 2] ?? "幼稚部";
  return locale === "ja" ? k : `Kindergarten (year ${grade + 3})`;
}

/**
 * "第5期（2016年 小学校卒業）" · "第21期（現在 小学1年生）"
 * "Class 5 (graduated 2016)" · "Class 21 (now Grade 1)"
 */
export function cohortLabel(
  c: Pick<CohortLike, "number" | "elementaryEndYear">,
  locale: "ja" | "en",
  now: Date = new Date(),
): string {
  const end = c.elementaryEndYear;
  if (isClassGraduated(end, now)) {
    return locale === "ja"
      ? `第${c.number}期（${end}年 小学校卒業）`
      : `Class ${c.number} (graduated ${end})`;
  }
  const grade = classGradeNow(end, now);
  if (grade !== null) {
    return locale === "ja"
      ? `第${c.number}期（現在 ${gradeLabel(grade, locale)}）`
      : `Class ${c.number} (now ${gradeLabel(grade, locale)})`;
  }
  return locale === "ja"
    ? `第${c.number}期（${end}年 卒業予定）`
    : `Class ${c.number} (graduating ${end})`;
}

/** Short form for badges: "第5期" / "Class 5". */
export function cohortShort(
  c: Pick<CohortLike, "number">,
  locale: "ja" | "en",
): string {
  return locale === "ja" ? `第${c.number}期` : `Class ${c.number}`;
}

export type CohortOption = { id: string; label: string; graduated: boolean };

export function cohortOptions(
  cohorts: CohortLike[],
  locale: "ja" | "en",
  now: Date = new Date(),
): CohortOption[] {
  return [...cohorts]
    .sort((a, b) => a.number - b.number)
    .map((c) => ({
      id: c.id,
      label: cohortLabel(c, locale, now),
      graduated: isClassGraduated(c.elementaryEndYear, now),
    }));
}

/** Upper bound for a 学年 number accepted from forms. */
export const MAX_COHORT_NUMBER = 200;

/** Parse a 学年 number from a form value ("" → null; invalid → undefined). */
export function parseCohortNumber(v: unknown): number | null | undefined {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= MAX_COHORT_NUMBER
    ? n
    : undefined;
}

/** Row values for a 学年 created on first use. */
export function defaultCohort(number: number) {
  const end = elementaryEndFor(number);
  return {
    number,
    elementaryEndYear: end,
    elementaryStartYear: suggestedStartYear(end),
  };
}

export type CohortChoice = { value: string; label: string; graduated: boolean };

/**
 * Every selectable 学年: 第1期 … this year's 年少 (plus any created later),
 * newest first.
 */
export function cohortChoices(
  existing: Pick<CohortLike, "number" | "elementaryEndYear">[],
  locale: "ja" | "en",
  now: Date = new Date(),
): CohortChoice[] {
  const byNumber = new Map(existing.map((c) => [c.number, c]));
  const max = Math.max(
    latestCohortNumber(now),
    ...existing.map((c) => c.number),
  );
  const out: CohortChoice[] = [];
  for (let n = max; n >= 1; n--) {
    const c = byNumber.get(n) ?? defaultCohort(n);
    out.push({
      value: String(n),
      label: cohortLabel(c, locale, now),
      graduated: isClassGraduated(c.elementaryEndYear, now),
    });
  }
  return out;
}
