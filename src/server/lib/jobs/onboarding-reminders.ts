import { AccountState } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { demoUserId } from "@/server/lib/demo/session";
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
import type { NotifyKind } from "@/server/lib/notify/catalog";
import { homePathFor } from "@/server/lib/state-machine";

const BATCH = 200;
/** Not in the first days after signing up: they may still be at it. */
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
/** Weekly reminders per member at most (about two months), then silence. */
export const MAX_REMINDERS = 8;

/** Who hasn't sent what the committee needs, and what to remind them of. */
const KIND_FOR_STATE: Partial<Record<AccountState, NotifyKind>> = {
  // Signed up and confirmed an email, application not submitted.
  [AccountState.EMAIL_VERIFIED]: "ONBOARDING_REMINDER",
  // The committee asked for more information, not sent yet.
  [AccountState.NEEDS_INFO]: "NEEDS_INFO_REMINDER",
};
const STATES = Object.keys(KIND_FOR_STATE) as AccountState[];
const KINDS = Object.values(KIND_FOR_STATE) as NotifyKind[];

/**
 * Weekly reminder to finish registering (Monday mornings): members who
 * signed up but haven't submitted their application, and those the
 * committee asked for more information. Not in their first 3 days, and at
 * most MAX_REMINDERS times each — then they're left alone (the committee
 * can still contact them). Accounts without an email address (LINE-first,
 * not confirmed yet) are reached only if they use app notifications.
 * One send per member per week (refId = the week's date, deduped); goes
 * through members in batches, saving progress, like stage-prompt.ts.
 */
export async function sendOnboardingReminders(
  ctx: JobContext,
): Promise<JobStep> {
  const week = ctx.at.toISOString().slice(0, 10);
  const demo = await demoUserId();
  const candidates = await db.user.findMany({
    where: {
      state: { in: STATES },
      createdAt: { lte: new Date(ctx.at.getTime() - GRACE_MS) },
      ...(demo ? { id: { not: demo } } : {}),
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  // Reminders already sent (one log row per channel: count weeks).
  const logs = await db.notificationLog.findMany({
    where: {
      userId: { in: candidates.map((u) => u.id) },
      kind: { in: KINDS },
    },
    select: { userId: true, refId: true },
  });
  const weeks = new Map<string, Set<string | null>>();
  for (const l of logs)
    weeks.set(l.userId, (weeks.get(l.userId) ?? new Set()).add(l.refId));
  const ids = candidates
    .map((u) => u.id)
    .filter((id) => {
      const sent = weeks.get(id);
      return !sent || sent.has(week) || sent.size < MAX_REMINDERS;
    });
  let sent = 0;

  const step = await eachIdBatch(
    ids,
    idCursor(ctx.cursor),
    { deadline: ctx.deadline, save: (c) => ctx.save(c) },
    BATCH,
    async (batch) => {
      const users = await db.user.findMany({
        where: { id: { in: batch }, state: { in: STATES } },
        select: {
          ...NOTIFY_USER_SELECT,
          state: true,
          lineOnboardingSeenAt: true,
        },
      });
      // One send per (reminder, onboarding page).
      const groups = new Map<string, NotifyUser[]>();
      for (const { state, lineOnboardingSeenAt, ...u } of users) {
        const key = `${KIND_FOR_STATE[state]} ${homePathFor({ state, lineOnboardingSeenAt })}`;
        groups.set(key, [...(groups.get(key) ?? []), u]);
      }
      const failed: string[] = [];
      for (const [key, group] of groups) {
        const [kind, path] = key.split(" ") as [NotifyKind, string];
        try {
          const res = await notifyBatch(
            group,
            { kind, refId: week, dedupe: true, path },
            { deadline: ctx.deadline },
          );
          sent += res.sent.size;
          failed.push(...res.failed, ...res.remaining);
        } catch (e) {
          failed.push(...group.map((u) => u.id));
          console.error(`[jobs/onboarding-reminders] ${key} failed`, e);
        }
      }
      return failed;
    },
  );
  const result = {
    week,
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
