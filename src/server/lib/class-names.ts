import { elementaryEndFor } from "@/server/lib/cohorts";

/**
 * AIS class names by grade: the kindergarten classes have names, then
 * 1st–6th grade. Grade numbers follow src/lib/school.ts (0 = 年長);
 * Jellyfish is the year before 年少.
 */
export const CLASS_NAMES: { grade: number; en: string; ja: string }[] = [
  { grade: -3, en: "Jellyfish", ja: "Jellyfish（2〜3歳）" },
  { grade: -2, en: "Starfish", ja: "Starfish（年少）" },
  { grade: -1, en: "Dolphin", ja: "Dolphin（年中）" },
  { grade: 0, en: "Orca", ja: "Orca（年長）" },
  { grade: 1, en: "1st grade", ja: "1st grade（小1）" },
  { grade: 2, en: "2nd grade", ja: "2nd grade（小2）" },
  { grade: 3, en: "3rd grade", ja: "3rd grade（小3）" },
  { grade: 4, en: "4th grade", ja: "4th grade（小4）" },
  { grade: 5, en: "5th grade", ja: "5th grade（小5）" },
  { grade: 6, en: "6th grade", ja: "6th grade（小6）" },
];

/**
 * For 第N期: which class they were in each school year (April → March), to
 * help members confirm their 学年. The school year starting in April Y is
 * grade Y + 7 − (6th-grade end year).
 */
export function classYears(
  cohortNumber: number,
): { schoolYear: number; grade: number; en: string; ja: string }[] {
  const end = elementaryEndFor(cohortNumber);
  return CLASS_NAMES.map((c) => ({
    ...c,
    schoolYear: end - 7 + c.grade,
  }));
}
