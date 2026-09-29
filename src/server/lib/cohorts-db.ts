import { cache } from "react";
import type { Prisma } from "@/server/generated/prisma/client";
import {
  type CohortLike,
  cohortChoices,
  cohortOptions,
  cohortShort,
  defaultCohort,
} from "@/server/lib/cohorts";
import { db } from "@/server/lib/db";

/** All 学年 (a small table: one row per class); cached per request. */
export const listCohorts = cache(async (): Promise<CohortLike[]> => {
  return db.cohort.findMany({
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      elementaryStartYear: true,
      elementaryEndYear: true,
    },
  });
});

export async function loadCohortOptions(locale: "ja" | "en") {
  return cohortOptions(await listCohorts(), locale);
}

/** id → "第N期" for display next to role details. */
export async function cohortShortLabels(
  locale: "ja" | "en",
): Promise<Record<string, string>> {
  const all = await listCohorts();
  return Object.fromEntries(all.map((c) => [c.id, cohortShort(c, locale)]));
}

/** Choices for 学年 pickers (value = 第N期 number). */
export async function loadCohortChoices(locale: "ja" | "en") {
  return cohortChoices(await listCohorts(), locale);
}

/**
 * The 学年 row for a number, created with default years/status the first
 * time anyone is assigned to it.
 */
export async function ensureCohort(
  number: number,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<string> {
  const row = await client.cohort.upsert({
    where: { number },
    update: {},
    create: defaultCohort(number),
    select: { id: true },
  });
  return row.id;
}

/** id → 第N期 number, for converting stored ids back to form values. */
export async function cohortNumbersById(): Promise<Map<string, number>> {
  return new Map((await listCohorts()).map((c) => [c.id, c.number]));
}
