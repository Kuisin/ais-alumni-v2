import type { Prisma } from "@/server/generated/prisma/client";
import { RoleKey } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { stageFromHistory } from "@/server/lib/history";

type Client = Prisma.TransactionClient | typeof db;

/**
 * 現在の状況 is worked out from 学歴・職歴 only (never typed in): the current
 * school (中学 / 高校 / 大学…) or else the current job, with its name as the
 * detail. Stored on the FORMER_STUDENT role so lists and filters can use it.
 * Returns true if it changed.
 */
export async function syncStageFromHistory(
  userId: string,
  client: Client = db,
  now: Date = new Date(),
): Promise<boolean> {
  const role = await client.userRole.findUnique({
    where: { userId_role: { userId, role: RoleKey.FORMER_STUDENT } },
    select: { id: true, currentStage: true, currentStageDetail: true },
  });
  if (!role) return false;
  const [education, work] = await Promise.all([
    client.educationEntry.findMany({
      where: { userId },
      select: {
        level: true,
        startYear: true,
        endYear: true,
        school: { select: { name: true } },
      },
    }),
    client.workEntry.findMany({
      where: { userId },
      select: {
        startYear: true,
        endYear: true,
        company: { select: { name: true } },
      },
    }),
  ]);
  const derived = stageFromHistory(
    education.map((e) => ({ ...e, school: e.school.name })),
    work.map((w) => ({ ...w, company: w.company.name })),
    now,
  );
  const stage = derived?.stage ?? null;
  const detail = derived?.detail ?? null;
  if (stage === role.currentStage && detail === role.currentStageDetail)
    return false;
  await client.userRole.update({
    where: { id: role.id },
    data: {
      currentStage: stage,
      currentStageDetail: detail,
      currentStageUpdatedAt: now,
    },
  });
  return true;
}
