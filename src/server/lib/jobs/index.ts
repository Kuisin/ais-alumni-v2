import { Prisma } from "@/server/generated/prisma/client";
import { sendChatDigest } from "@/server/lib/chat-db";
import { db } from "@/server/lib/db";
import { deadlineFrom, leaseUntil } from "@/server/lib/jobs/budget";
import { sendUnreadChatNotices } from "@/server/lib/jobs/chat-unread";
import { cleanupEvidence } from "@/server/lib/jobs/cleanup-evidence";
import {
  type JobContext,
  type JobStep,
  PartialFailure,
} from "@/server/lib/jobs/context";
import { sendEventReminders } from "@/server/lib/jobs/event-reminders";
import { publishDueNews } from "@/server/lib/jobs/publish-news";
import {
  daily,
  EVERY_MINUTE,
  lastSlot,
  type Schedule,
  yearly,
} from "@/server/lib/jobs/schedule";
import { sendStagePrompt } from "@/server/lib/jobs/stage-prompt";
import { syncStatus } from "@/server/lib/jobs/sync-status";
import { syncLineMenus } from "@/server/lib/line-menu-sync";
import { checkPushReceipts } from "@/server/lib/push/receipts";

/**
 * Every recurring task. One Supabase pg_cron job calls GET /api/cron every
 * minute (scripts/setup-supabase-cron.ts). Each call works through the
 * tasks that are due, within a time budget (budget.ts) that keeps it under
 * Vercel's 5-minute limit:
 * - due = its latest slot (every minute, daily HH:MM or yearly MM-DD HH:MM
 *   JST) isn't finished yet (CronRun.doneAt);
 * - a task is claimed with a lease, so overlapping calls never run it twice;
 * - work stops at the budget and the next call continues from the saved
 *   progress (CronRun.cursor);
 * - a failure is retried by the next call, i.e. within a minute, until it
 *   succeeds (what already succeeded is skipped: every task is safe to rerun);
 * - a call killed mid-task frees the task when its lease ends (~5.5 min).
 * GET /api/cron?task=<name> runs one task now (tests, manual reruns).
 */
type Job = { schedule: Schedule; run: (ctx: JobContext) => Promise<JobStep> };

export const JOBS = {
  // Reserved ニュース and response-deadline reminders.
  "publish-news": { schedule: EVERY_MINUTE, run: publishDueNews },
  // LINE rich menu unread dots (only calls LINE when a member's changes).
  "line-menus": {
    schedule: EVERY_MINUTE,
    run: async (ctx) => {
      const res = await syncLineMenus({ deadline: ctx.deadline });
      if (res.failed)
        throw new PartialFailure(`${res.failed} member(s) not linked`, res);
      return { done: res.remaining === 0, result: res };
    },
  },
  // 1:1 messages and @mentions unread for 5 minutes: one notice per streak.
  "chat-unread": { schedule: EVERY_MINUTE, run: sendUnreadChatNotices },
  // App push delivery receipts: retire tokens that no longer work.
  "push-receipts": { schedule: EVERY_MINUTE, run: checkPushReceipts },
  // 7-day / 1-day event reminders (§10.3).
  "event-reminders": { schedule: daily("09:00"), run: sendEventReminders },
  // Unread group-chat digest (count and link only).
  "chat-digest": {
    schedule: daily("20:00"),
    run: async (ctx) => {
      const res = await sendChatDigest(ctx.at, { deadline: ctx.deadline });
      if (res.failed)
        throw new PartialFailure(`${res.failed} member(s) not reached`, res);
      return { done: res.remaining === 0, result: res };
    },
  },
  // Current/former, grades and group chats as the school year passes.
  "sync-status": { schedule: daily("00:05"), run: syncStatus },
  // Delete verification evidence 30 days after the decision (§6.3).
  "cleanup-evidence": { schedule: daily("03:00"), run: cleanupEvidence },
  // Yearly "is your status still …?" prompt (§7).
  "stage-prompt": { schedule: yearly("04-01 09:00"), run: sendStagePrompt },
} satisfies Record<string, Job>;

export type JobName = keyof typeof JOBS;

export function isJobName(name: string): name is JobName {
  return Object.hasOwn(JOBS, name);
}

export type JobOutcome = {
  done: boolean;
  result?: Record<string, unknown>;
  error?: string;
  cursor?: Prisma.InputJsonValue;
};

async function execute(name: JobName, ctx: JobContext): Promise<JobOutcome> {
  try {
    const step = await (JOBS[name] as Job).run(ctx);
    return { done: step.done, result: step.result, cursor: step.cursor };
  } catch (e) {
    console.error(`[jobs] ${name} failed`, e);
    return {
      done: false,
      error: e instanceof Error ? e.message : String(e),
      result: e instanceof PartialFailure ? e.result : undefined,
    };
  }
}

/** Run one task now, from the start (no claim; every task is rerunnable). */
export function runJob(
  name: JobName,
  now: Date = new Date(),
): Promise<JobOutcome> {
  return execute(name, {
    at: now,
    deadline: deadlineFrom(),
    cursor: null,
    save: async () => {},
  });
}

const isMinute = (s: Schedule) => "every" in s;

/**
 * Claim the task for this call: its slot is new, or unfinished and not held
 * by another call. A new slot starts over (cursor cleared). A task seen for
 * the first time counts its current daily / yearly slot as done, so a time
 * that passed before it was scheduled here (e.g. this year's April 1) isn't
 * run. Returns the saved progress, or null when not claimed.
 */
async function claim(
  name: JobName,
  slot: Date,
): Promise<{ cursor: Prisma.JsonValue | null } | null> {
  const now = new Date();
  const first = isMinute(JOBS[name].schedule)
    ? new Date(slot.getTime() - 60_000)
    : slot;
  await db.$executeRaw`
    INSERT INTO "CronRun" ("task", "slot", "doneAt", "updatedAt")
    VALUES (${name}, ${first}, ${now}, ${now})
    ON CONFLICT ("task") DO NOTHING`;
  const rows = await db.$queryRaw<{ cursor: Prisma.JsonValue | null }[]>`
    UPDATE "CronRun" SET
      "cursor" = CASE WHEN "slot" < ${slot} THEN NULL ELSE "cursor" END,
      "attempts" = CASE WHEN "slot" < ${slot} THEN 1 ELSE "attempts" + 1 END,
      "slot" = GREATEST("slot", ${slot}),
      "doneAt" = NULL,
      "lockedUntil" = ${leaseUntil()},
      "updatedAt" = ${now}
    WHERE "task" = ${name}
      AND ("slot" < ${slot} OR "doneAt" IS NULL)
      AND ("lockedUntil" IS NULL OR "lockedUntil" < ${now})
    RETURNING "cursor"`;
  return rows[0] ?? null;
}

/** Record the call's outcome and release the claim. */
async function finish(name: JobName, o: JobOutcome): Promise<void> {
  const result = (o.result ?? Prisma.DbNull) as Prisma.InputJsonValue;
  await db.cronRun.update({
    where: { task: name },
    data: o.done
      ? {
          doneAt: new Date(),
          lockedUntil: null,
          cursor: Prisma.DbNull,
          lastResult: result,
          lastError: null,
        }
      : {
          lockedUntil: null,
          ...(o.cursor !== undefined ? { cursor: o.cursor } : {}),
          lastResult: result,
          lastError: o.error ?? null,
        },
  });
}

/** The every-minute call: work through what is due, within the budget. */
export async function runDueJobs(
  now: Date = new Date(),
): Promise<Partial<Record<JobName, JobOutcome | "later">>> {
  // The budget runs on the real clock, whatever `now` says.
  const deadline = deadlineFrom();
  const out: Partial<Record<JobName, JobOutcome | "later">> = {};
  for (const name of Object.keys(JOBS) as JobName[]) {
    // Out of time: still due, so the next call starts it.
    if (Date.now() > deadline) {
      out[name] = "later";
      continue;
    }
    const schedule = JOBS[name].schedule;
    const slot = lastSlot(schedule, now);
    const claimed = await claim(name, slot);
    if (!claimed) continue;
    const outcome = await execute(name, {
      at: isMinute(schedule) ? now : slot,
      deadline,
      cursor: claimed.cursor,
      save: async (cursor) => {
        await db.cronRun.update({
          where: { task: name },
          data: { cursor, lockedUntil: leaseUntil() },
        });
      },
    });
    await finish(name, outcome);
    out[name] = outcome;
  }
  return out;
}
