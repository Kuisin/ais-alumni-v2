import { AccountState, RsvpAnswer } from "@/server/generated/prisma/enums";
import { eventApprovedWhere } from "@/server/lib/approval";
import { db } from "@/server/lib/db";
import { reminderWindows, type Window } from "@/server/lib/events";
import { localized } from "@/server/lib/format";
import {
  type JobContext,
  type JobStep,
  PartialFailure,
  pastDeadline,
} from "@/server/lib/jobs/context";
import { NOTIFY_USER_SELECT, notifyBatch } from "@/server/lib/notify";

type Kind = "EVENT_REMINDER_7D" | "EVENT_REMINDER_1D";
type Tally = {
  events: number;
  recipients: number;
  failed: number;
  remaining: number;
};

async function remind(
  kind: Kind,
  window: Window,
  ctx: JobContext,
): Promise<Tally> {
  const events = await db.event.findMany({
    where: {
      startsAt: { gte: window.from, lt: window.to },
      AND: [eventApprovedWhere],
    },
    select: {
      id: true,
      titleJa: true,
      titleEn: true,
      startsAt: true,
      location: true,
      rsvps: {
        where: {
          answer: { in: [RsvpAnswer.GOING, RsvpAnswer.MAYBE] },
          user: { state: AccountState.ACTIVE },
        },
        select: { user: { select: NOTIFY_USER_SELECT } },
      },
    },
  });

  const tally: Tally = {
    events: events.length,
    recipients: 0,
    failed: 0,
    remaining: 0,
  };
  for (const event of events) {
    const users = event.rsvps.map((r) => r.user);
    if (!users.length) continue;
    if (pastDeadline(ctx)) {
      tally.remaining += users.length;
      continue;
    }
    try {
      const res = await notifyBatch(
        users,
        {
          kind,
          refId: event.id,
          dedupe: true,
          path: `/app/events/${event.id}`,
          params: (locale) => ({
            title: localized(event.titleJa, event.titleEn, locale).text,
            when: event.startsAt,
            location: event.location,
          }),
        },
        { deadline: ctx.deadline },
      );
      tally.recipients += res.sent.size;
      tally.failed += res.failed.length;
      tally.remaining += res.remaining.length;
    } catch (e) {
      // One failing event must not block the others; retried next call.
      tally.failed += users.length;
      console.error(`[jobs/event-reminders] ${kind} ${event.id} failed`, e);
    }
  }
  return tally;
}

/**
 * Event reminders to GOING/MAYBE RSVPs of ACTIVE members (§10.3). Windows
 * are whole JST days from the slot (see reminderWindows): 7D = the date one
 * week ahead, 1D = tomorrow. De-duplicated per (kind, event id), so a
 * retry or continuation reaches only those not reached yet.
 */
export async function sendEventReminders(ctx: JobContext): Promise<JobStep> {
  const windows = reminderWindows(ctx.at);
  const reminder7d = await remind("EVENT_REMINDER_7D", windows.d7, ctx);
  const reminder1d = await remind("EVENT_REMINDER_1D", windows.d1, ctx);
  const result = { reminder7d, reminder1d };
  if (reminder7d.failed || reminder1d.failed)
    throw new PartialFailure(
      `${reminder7d.failed + reminder1d.failed} reminder(s) failed`,
      result,
    );
  return {
    done: reminder7d.remaining + reminder1d.remaining === 0,
    result,
  };
}
