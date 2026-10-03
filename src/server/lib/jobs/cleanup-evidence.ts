import { db } from "@/server/lib/db";
import {
  type JobContext,
  type JobStep,
  PartialFailure,
  pastDeadline,
} from "@/server/lib/jobs/context";
import { deletePrivate } from "@/server/lib/storage";

const PAGE = 200;

/**
 * Delete verification evidence 30 days after the decision (§6.3). A row is
 * removed only after its storage object is deleted, so a failed delete is
 * retried on the next call.
 */
export async function cleanupEvidence(ctx: JobContext): Promise<JobStep> {
  let objectsDeleted = 0;
  let failed = 0;
  const skip = new Set<string>(); // failed in this call
  for (;;) {
    if (pastDeadline(ctx))
      return { done: false, result: { objectsDeleted, failed } };
    const due = await db.verificationEvidence.findMany({
      where: { deleteAfter: { lt: ctx.at }, id: { notIn: [...skip] } },
      select: { id: true, storageKey: true },
      orderBy: { id: "asc" },
      take: PAGE,
    });
    if (due.length === 0) break;
    for (const row of due) {
      if (pastDeadline(ctx)) break;
      try {
        await deletePrivate(row.storageKey);
        await db.verificationEvidence.delete({ where: { id: row.id } });
        objectsDeleted++;
      } catch (e) {
        failed++;
        skip.add(row.id);
        console.error(`[jobs/cleanup-evidence] ${row.storageKey}`, e);
      }
    }
  }
  const result = { objectsDeleted, failed };
  if (failed) throw new PartialFailure(`${failed} file(s) not deleted`, result);
  return { done: true, result };
}
