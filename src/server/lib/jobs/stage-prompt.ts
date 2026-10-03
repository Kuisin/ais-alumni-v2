import type { LifeStage } from "@/server/generated/prisma/enums";
import { AccountState, RoleKey } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { jstYear } from "@/server/lib/account";
import { db } from "@/server/lib/db";
import {
  eachIdBatch,
  idCursor,
  type JobContext,
  type JobStep,
  PartialFailure,
} from "@/server/lib/jobs/context";
import {
  NOTIFY_USER_SELECT,
  type NotifyUser,
  notifyBatch,
} from "@/server/lib/notify";

const BATCH = 200;

const WHERE = {
  state: AccountState.ACTIVE,
  roles: { some: { role: RoleKey.FORMER_STUDENT } },
};

/**
 * Yearly "are your schools & work up to date?" prompt (§7). Every ACTIVE
 * user with a FORMER_STUDENT role gets one notification per year (kind
 * STAGE_PROMPT, refId = year, deduped). Goes through members in id order in
 * batches, saving progress; members whose send failed are retried first on
 * the next call. Grouped by current stage because the text names the stage.
 */
export async function sendStagePrompt(ctx: JobContext): Promise<JobStep> {
  const year = String(jstYear(ctx.at));
  const ids = (
    await db.user.findMany({
      where: WHERE,
      select: { id: true },
      orderBy: { id: "asc" },
    })
  ).map((u) => u.id);
  let sent = 0;

  const step = await eachIdBatch(
    ids,
    idCursor(ctx.cursor),
    { deadline: ctx.deadline, save: (c) => ctx.save(c) },
    BATCH,
    async (batch) => {
      const users = await db.user.findMany({
        where: { id: { in: batch }, ...WHERE },
        select: {
          ...NOTIFY_USER_SELECT,
          roles: {
            where: { role: RoleKey.FORMER_STUDENT },
            select: { currentStage: true },
          },
        },
      });
      const byStage = new Map<LifeStage | null, NotifyUser[]>();
      for (const { roles, ...u } of users) {
        const stage = roles[0]?.currentStage ?? null;
        byStage.set(stage, [...(byStage.get(stage) ?? []), u]);
      }
      const failed: string[] = [];
      for (const [stage, group] of byStage) {
        try {
          const res = await notifyBatch(
            group,
            {
              kind: "STAGE_PROMPT",
              refId: year,
              dedupe: true,
              path: "/app/profile/history",
              params: async (locale) => {
                if (!stage) return { stage: "—" };
                const tr = await getTranslatorFor(locale, "roles");
                return { stage: tr(`stage.${stage}`) };
              },
            },
            { deadline: ctx.deadline },
          );
          sent += res.sent.size;
          failed.push(...res.failed, ...res.remaining);
        } catch (e) {
          failed.push(...group.map((u) => u.id));
          console.error(`[jobs/stage-prompt] stage=${stage} failed`, e);
        }
      }
      return failed;
    },
  );
  const result = {
    year,
    members: ids.length,
    sent,
    failed: step.cursor.failed.length,
  };
  if (step.done && step.cursor.failed.length)
    throw new PartialFailure(
      `${step.cursor.failed.length} member(s) not reached`,
      result,
    );
  return { done: step.done, cursor: step.cursor, result };
}
