import { z } from "zod";
import {
  EducationLevel,
  HistoryVisibility,
  LifeStage,
} from "@/server/generated/prisma/enums";
import { isIndustryCode } from "@/server/lib/industries";
import { isJobTypeCode } from "@/server/lib/job-types";
import { calendarYear } from "@/server/lib/school";

/**
 * 学歴 / 職歴 (education and work history). Pure helpers: validation,
 * ordering, visibility and the "current stage" they imply.
 */

type Entry = { startYear: number | null; endYear: number | null };

const year = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1950 || n > 2100) {
      ctx.addIssue({ code: "custom", message: "invalidYear" });
      return z.NEVER;
    }
    return n;
  });
const text = (max: number) => z.string().trim().max(max, "tooLong");
const optional = (max: number) => text(max).transform((v) => v || null);

function ordered<T extends Entry>(v: T, ctx: z.RefinementCtx) {
  if (v.startYear !== null && v.endYear !== null && v.endYear < v.startYear) {
    ctx.addIssue({ code: "custom", path: ["endYear"], message: "yearsOrder" });
  }
}

export const educationSchema = z
  .object({
    level: z.enum(EducationLevel, { error: "required" }),
    school: text(120).min(1, "required"),
    field: optional(120),
    startYear: year,
    endYear: year,
    visibility: z.enum(HistoryVisibility),
  })
  .superRefine(ordered);

export const workSchema = z
  .object({
    company: text(120).min(1, "required"),
    title: optional(120),
    /** 業種 code (src/lib/industries.ts); empty = not given */
    industry: z
      .string()
      .trim()
      .max(40)
      .refine((v) => !v || isIndustryCode(v), "invalid")
      .transform((v) => v || null),
    /** 職種 code (src/lib/job-types.ts); empty = not given */
    jobType: z
      .string()
      .trim()
      .max(40)
      .refine((v) => !v || isJobTypeCode(v), "invalid")
      .transform((v) => v || null),
    startYear: year,
    endYear: year,
    visibility: z.enum(HistoryVisibility),
  })
  .superRefine(ordered);

/** Ongoing: no end year, or it ends this year or later. */
export function isOngoing(e: Entry, now: Date = new Date()): boolean {
  return e.endYear === null || e.endYear >= calendarYear(now);
}

/** Current first, then most recent. */
export function sortHistory<T extends Entry>(
  entries: readonly T[],
  now: Date = new Date(),
): T[] {
  return [...entries].sort((a, b) => {
    const oa = isOngoing(a, now) ? 1 : 0;
    const ob = isOngoing(b, now) ? 1 : 0;
    if (oa !== ob) return ob - oa;
    return (
      (b.endYear ?? 9999) - (a.endYear ?? 9999) ||
      (b.startYear ?? 0) - (a.startYear ?? 0)
    );
  });
}

/** Entries a viewer may see: MEMBERS always; FOLLOWERS only with private access. */
export function visibleHistory<T extends { visibility: HistoryVisibility }>(
  entries: readonly T[],
  canViewPrivate: boolean,
): T[] {
  return entries.filter(
    (e) => canViewPrivate || e.visibility === HistoryVisibility.MEMBERS,
  );
}

const LEVEL_STAGE: Partial<Record<EducationLevel, LifeStage>> = {
  JUNIOR_HIGH: LifeStage.JUNIOR_HIGH,
  HIGH_SCHOOL: LifeStage.HIGH_SCHOOL,
  UNIVERSITY: LifeStage.UNIVERSITY_COLLEGE,
  GRADUATE_SCHOOL: LifeStage.UNIVERSITY_COLLEGE,
  VOCATIONAL: LifeStage.UNIVERSITY_COLLEGE,
};

type StageEntry =
  | (Entry & { kind: "education"; level: EducationLevel; name: string })
  | (Entry & { kind: "work"; name: string });

function stageOf(e: StageEntry): LifeStage | null {
  return e.kind === "work" ? LifeStage.WORKING : (LEVEL_STAGE[e.level] ?? null);
}

/** Newest first: later start, then later (or no) end; school on a tie. */
function newestFirst(a: StageEntry, b: StageEntry): number {
  return (
    (b.startYear ?? 0) - (a.startYear ?? 0) ||
    (b.endYear ?? 9999) - (a.endYear ?? 9999) ||
    (a.kind === "education" ? -1 : 0) - (b.kind === "education" ? -1 : 0)
  );
}

function stageEntries(
  education: readonly (Entry & { level: EducationLevel; school: string })[],
  work: readonly (Entry & { company: string })[],
): StageEntry[] {
  return [
    ...education.map((e) => ({
      ...e,
      kind: "education" as const,
      name: e.school,
    })),
    ...work.map((w) => ({ ...w, kind: "work" as const, name: w.company })),
  ].filter((e) => stageOf(e) !== null);
}

/**
 * Current stage implied by the history, with the school / company name as
 * the detail: the most recently started ongoing entry (a job started after
 * university means 社会人). With nothing ongoing, the latest entry's status
 * carries over (someone between jobs stays 社会人). Null without history.
 */
export function stageFromHistory(
  education: readonly (Entry & { level: EducationLevel; school: string })[],
  work: readonly (Entry & { company: string })[],
  now: Date = new Date(),
): { stage: LifeStage; detail: string } | null {
  const all = stageEntries(education, work);
  const ongoing = all.filter((e) => isOngoing(e, now)).sort(newestFirst);
  const latest =
    ongoing[0] ??
    [...all].sort(
      (a, b) => (b.endYear ?? 9999) - (a.endYear ?? 9999) || newestFirst(a, b),
    )[0];
  if (!latest) return null;
  return { stage: stageOf(latest) as LifeStage, detail: latest.name };
}

/**
 * Entries marked 現在 (no end year). More than one usually means an old one
 * wasn't closed; the current stage then uses the newest.
 */
export function currentEntries<T extends Entry>(entries: readonly T[]): T[] {
  return entries.filter((e) => e.endYear === null);
}
