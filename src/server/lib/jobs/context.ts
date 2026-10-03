import type { Prisma } from "@/server/generated/prisma/client";

/** What a recurring task gets for one call (src/lib/jobs/index.ts). */
export type JobContext = {
  /** the task's time: its slot (daily / yearly) or now (every minute) */
  at: Date;
  /** stop starting new work after this (ms timestamp) */
  deadline: number;
  /** progress saved by an earlier call for the same slot (null at first) */
  cursor: Prisma.JsonValue | null;
  /** save progress now, so a killed call resumes from here */
  save: (cursor: Prisma.InputJsonValue) => Promise<void>;
};

/**
 * One call's work. done = false: stopped at the deadline, continue next
 * call (from `cursor`). Failures are thrown after doing what could be done;
 * the next call retries (what already succeeded is skipped).
 */
export type JobStep = {
  done: boolean;
  cursor?: Prisma.InputJsonValue;
  result: Record<string, unknown>;
};

export function pastDeadline(ctx: { deadline: number }): boolean {
  return Date.now() > ctx.deadline;
}

/** Thrown when some items failed; the rest were done. */
export class PartialFailure extends Error {
  constructor(
    message: string,
    readonly result: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Progress through a sorted id list: done up to `after`; `failed` to retry. */
export type IdCursor = { after: string | null; failed: string[] };

export const START: IdCursor = { after: null, failed: [] };

export function idCursor(v: unknown): IdCursor {
  const c = v as Partial<IdCursor> | null;
  return {
    after: typeof c?.after === "string" ? c.after : null,
    failed: Array.isArray(c?.failed)
      ? c.failed.filter((x): x is string => typeof x === "string")
      : [],
  };
}

/**
 * Work through `ids` (sorted ascending) in batches: first the ids that
 * failed before, then those after the cursor. `fn` returns the ids of its
 * batch that failed (kept for the next call). Progress is saved after every
 * batch; stops at the deadline.
 */
export async function eachIdBatch(
  ids: string[],
  from: IdCursor,
  ctx: Pick<JobContext, "deadline"> & {
    save: (cursor: IdCursor) => Promise<void>;
  },
  size: number,
  fn: (batch: string[]) => Promise<string[]>,
): Promise<{ done: boolean; cursor: IdCursor; count: number }> {
  let count = 0;
  const failed: string[] = [];
  const retry = [...from.failed];
  while (retry.length) {
    if (pastDeadline(ctx))
      return {
        done: false,
        cursor: { after: from.after, failed: [...failed, ...retry] },
        count,
      };
    const batch = retry.splice(0, size);
    failed.push(...(await fn(batch)));
    count += batch.length;
    await ctx.save({ after: from.after, failed: [...failed, ...retry] });
  }
  const todo = ids.filter((id) => from.after === null || id > from.after);
  let after = from.after;
  for (let i = 0; i < todo.length; i += size) {
    if (pastDeadline(ctx))
      return { done: false, cursor: { after, failed }, count };
    const batch = todo.slice(i, i + size);
    failed.push(...(await fn(batch)));
    after = batch[batch.length - 1];
    count += batch.length;
    await ctx.save({ after, failed });
  }
  return { done: true, cursor: { after, failed }, count };
}

/** Run `fn` for each id; the ids whose call threw. */
export async function eachOrFailed(
  batch: string[],
  fn: (id: string) => Promise<unknown>,
  label: string,
): Promise<string[]> {
  const failed: string[] = [];
  for (const id of batch) {
    try {
      await fn(id);
    } catch (e) {
      failed.push(id);
      console.error(`[jobs/${label}] ${id} failed`, e);
    }
  }
  return failed;
}
