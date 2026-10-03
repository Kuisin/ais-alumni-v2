import { db } from "@/server/lib/db";
import {
  type JobContext,
  type JobStep,
  PartialFailure,
  pastDeadline,
} from "@/server/lib/jobs/context";
import { retirePushDevices } from "./devices";
import { fetchExpoReceipts, isOutboxTicket } from "./expo";

/** Expo has receipts ready ~15 minutes after sending and keeps them a day. */
const READY_AFTER_MS = 15 * 60 * 1000;
const KEPT_MS = 24 * 60 * 60 * 1000;
const BATCH = 1000;

/**
 * Every minute: delivery receipts for app pushes sent at least 15 minutes
 * ago. A token Apple / Google no longer accepts (DeviceNotRegistered) is
 * retired, so those members get LINE / email again; other errors are
 * logged (bad credentials show up here). Tickets are dropped once checked,
 * or after a day without a receipt.
 */
export async function checkPushReceipts(ctx: JobContext): Promise<JobStep> {
  const now = Date.now();
  const expired = await db.pushTicket.deleteMany({
    where: { createdAt: { lt: new Date(now - KEPT_MS) } },
  });
  let checked = 0;
  let retired = 0;
  let errors = 0;
  let failedRequests = 0;
  let after: { createdAt: Date; id: string } | null = null;
  while (!pastDeadline(ctx)) {
    const tickets: { id: string; deviceId: string; createdAt: Date }[] =
      await db.pushTicket.findMany({
        where: {
          createdAt: { lte: new Date(now - READY_AFTER_MS) },
          ...(after
            ? {
                OR: [
                  { createdAt: { gt: after.createdAt } },
                  { createdAt: after.createdAt, id: { gt: after.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: BATCH,
        select: { id: true, deviceId: true, createdAt: true },
      });
    if (tickets.length === 0) break;
    const last = tickets[tickets.length - 1];
    after = { createdAt: last.createdAt, id: last.id };

    let receipts: Awaited<ReturnType<typeof fetchExpoReceipts>>;
    try {
      receipts = await fetchExpoReceipts(tickets.map((t) => t.id));
    } catch (e) {
      console.error("[push-receipts] fetch failed", e);
      failedRequests++;
      continue;
    }
    const done: string[] = [];
    const dead: string[] = [];
    for (const t of tickets) {
      if (isOutboxTicket(t.id)) {
        done.push(t.id);
        continue;
      }
      const r = receipts[t.id];
      if (!r) continue; // not ready yet — next time (dropped after a day)
      done.push(t.id);
      checked++;
      if (r.status === "error") {
        if (r.details?.error === "DeviceNotRegistered") dead.push(t.deviceId);
        else {
          errors++;
          console.error(
            `[push-receipts] ${t.deviceId}: ${r.details?.error ?? ""} ${r.message}`,
          );
        }
      }
    }
    await retirePushDevices(dead);
    retired += dead.length;
    if (done.length)
      await db.pushTicket.deleteMany({ where: { id: { in: done } } });
    if (tickets.length < BATCH) break;
  }
  const result = {
    checked,
    retired,
    errors,
    expired: expired.count,
    failedRequests,
  };
  if (failedRequests)
    throw new PartialFailure("receipt request(s) failed", result);
  return { done: !pastDeadline(ctx), result };
}
