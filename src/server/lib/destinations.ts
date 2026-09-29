import type { EducationLevel } from "@/server/generated/prisma/enums";
import { isOngoing } from "@/server/lib/history";

/**
 * Where former students went after AIS (進路), worked out from their
 * 学歴・職歴 (pure; unit-tested).
 */

type Entry = { startYear: number | null; endYear: number | null };
export type EduEntry = Entry & { level: EducationLevel; school: string };
export type WorkEntry = Entry & { company: string };

/** Columns of the 進路 table, in order. */
export const PATH_LEVELS = [
  "JUNIOR_HIGH",
  "HIGH_SCHOOL",
  "UNIVERSITY",
  "GRADUATE_SCHOOL",
] as const satisfies readonly EducationLevel[];
export type PathLevel = (typeof PATH_LEVELS)[number];

export type Path = {
  /** first school attended at each level */
  schools: Partial<Record<PathLevel, string>>;
  /** where they are now: a current job, else a current school */
  now: { kind: "work" | "school"; name: string } | null;
  hasHistory: boolean;
};

const byStart = (a: Entry, b: Entry) =>
  (a.startYear ?? Number.POSITIVE_INFINITY) -
  (b.startYear ?? Number.POSITIVE_INFINITY);

export function pathOf(
  education: readonly EduEntry[],
  work: readonly WorkEntry[],
  now: Date = new Date(),
): Path {
  const schools: Path["schools"] = {};
  for (const e of [...education].sort(byStart)) {
    const level = e.level as PathLevel;
    if (PATH_LEVELS.includes(level) && !schools[level])
      schools[level] = e.school;
  }
  // Latest-started ongoing entry wins; a job before a school.
  const latest = <T extends Entry>(xs: readonly T[]) =>
    xs
      .filter((x) => isOngoing(x, now))
      .sort(byStart)
      .at(-1);
  const job = latest(work);
  const school = latest(education);
  return {
    schools,
    now: job
      ? { kind: "work", name: job.company }
      : school
        ? { kind: "school", name: school.school }
        : null,
    hasHistory: education.length + work.length > 0,
  };
}

/** Most common names (people counted once each), most first. */
export function topNames(
  names: readonly (string | null | undefined)[],
  limit = 10,
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const n of names) if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}
