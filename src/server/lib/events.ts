/**
 * Pure event/RSVP rules (§10.3). No imports so they are unit-testable without
 * path aliases or a database.
 */

export type RsvpAnswerValue = "GOING" | "MAYBE" | "NOT_GOING";

export const MAX_GUESTS = 5;

/** Locale from a route param / next-intl locale string. */
export function asLocale(value: string): "ja" | "en" {
  return value === "en" ? "en" : "ja";
}

/** People attending: every GOING RSVP counts itself plus its guests. */
export function headcount(
  rsvps: readonly { answer: RsvpAnswerValue; guests: number }[],
): number {
  return rsvps.reduce(
    (n, r) => (r.answer === "GOING" ? n + 1 + r.guests : n),
    0,
  );
}

/** Spots left, or null when the event has no capacity limit. Never negative. */
export function remainingSpots(
  capacity: number | null,
  going: number,
): number | null {
  if (capacity === null) return null;
  return Math.max(0, capacity - going);
}

/**
 * RSVPs close at the RSVP deadline, or at the start of the event if there is
 * no deadline (assumption: nobody can RSVP to an event that has started).
 */
export function rsvpClosesAt(event: {
  startsAt: Date;
  rsvpDeadline: Date | null;
}): Date {
  if (event.rsvpDeadline && event.rsvpDeadline < event.startsAt)
    return event.rsvpDeadline;
  return event.startsAt;
}

export function isRsvpOpen(
  event: {
    startsAt: Date;
    rsvpDeadline: Date | null;
    /** closed early by the organiser */
    rsvpClosedAt?: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (event.rsvpClosedAt) return false;
  return now < rsvpClosesAt(event);
}

export type RsvpDenial = "closed" | "capacity" | "guests";

/**
 * Validate an RSVP. `othersGoing` is the headcount of all OTHER users' GOING
 * RSVPs (so changing one's own guest count is judged fairly). Only GOING can
 * be refused for capacity; MAYBE / NOT_GOING are always accepted while open.
 */
export function checkRsvp(input: {
  event: {
    startsAt: Date;
    rsvpDeadline: Date | null;
    rsvpClosedAt?: Date | null;
    capacity: number | null;
  };
  answer: RsvpAnswerValue;
  guests: number;
  othersGoing: number;
  now?: Date;
}): { ok: true } | { ok: false; reason: RsvpDenial } {
  const { event, answer, guests, othersGoing } = input;
  if (!isRsvpOpen(event, input.now ?? new Date()))
    return { ok: false, reason: "closed" };
  if (!Number.isInteger(guests) || guests < 0 || guests > MAX_GUESTS) {
    return { ok: false, reason: "guests" };
  }
  if (
    answer === "GOING" &&
    event.capacity !== null &&
    othersGoing + 1 + guests > event.capacity
  ) {
    return { ok: false, reason: "capacity" };
  }
  return { ok: true };
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of 00:00 JST on the JST calendar day `offsetDays` after `now`'s. */
export function jstDayStart(now: Date, offsetDays = 0): Date {
  const jstMidnight =
    Math.floor((now.getTime() + JST_OFFSET_MS) / DAY_MS) * DAY_MS;
  return new Date(jstMidnight - JST_OFFSET_MS + offsetDays * DAY_MS);
}

export type Window = { from: Date; to: Date };

/**
 * Reminder windows for the daily 09:00 JST cron (§10.3). Windows are whole
 * JST calendar days so that, with one run per day, every event falls in each
 * window exactly once and the two windows never overlap:
 *   - 7-day reminder: events starting on the JST date 7 days from today
 *     (i.e. 6 days 15 h – 7 days 15 h after a 09:00 run);
 *   - 1-day reminder: events starting tomorrow (JST), i.e. 15 h – 39 h after
 *     a 09:00 run.
 * `from` is inclusive and `to` exclusive. Retries on the same day are safe
 * because sends are de-duplicated by (kind, event id).
 */
export function reminderWindows(now: Date): { d7: Window; d1: Window } {
  return {
    d7: { from: jstDayStart(now, 7), to: jstDayStart(now, 8) },
    d1: { from: jstDayStart(now, 1), to: jstDayStart(now, 2) },
  };
}

/** Counts and guest totals per answer, for the admin attendee summary. */
export function answerSummary(
  rsvps: readonly { answer: RsvpAnswerValue; guests: number }[],
): Record<RsvpAnswerValue, { count: number; guests: number }> {
  const out: Record<RsvpAnswerValue, { count: number; guests: number }> = {
    GOING: { count: 0, guests: 0 },
    MAYBE: { count: 0, guests: 0 },
    NOT_GOING: { count: 0, guests: 0 },
  };
  for (const r of rsvps) {
    out[r.answer].count++;
    out[r.answer].guests += r.guests;
  }
  return out;
}

/** Map link: the admin-supplied URL if safe, else a Google Maps search. */
export function mapLink(
  mapUrl: string | null,
  location: string | null,
): string | null {
  if (mapUrl && /^https?:\/\//i.test(mapUrl)) return mapUrl;
  if (location?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
  }
  return null;
}

/** RFC 4180 CSV field. Also neutralises spreadsheet formula injection. */
export function csvField(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV document with a UTF-8 BOM so Excel opens Japanese text correctly. */
export function toCsv(
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  return `﻿${rows.map((r) => r.map(csvField).join(",")).join("\r\n")}\r\n`;
}
