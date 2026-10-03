/**
 * When a scheduled task is due. Times are JST (UTC+9, no daylight saving).
 * The single cron call comes every minute; a daily / yearly task runs once
 * its latest slot has passed and it hasn't run since (src/lib/jobs/index.ts),
 * so a missed call is caught up on the next one.
 */

export type Schedule =
  | { every: "minute" }
  | { daily: string } // "HH:MM" JST
  | { yearly: string }; // "MM-DD HH:MM" JST

export const EVERY_MINUTE: Schedule = { every: "minute" };
export const daily = (at: string): Schedule => ({ daily: at });
export const yearly = (at: string): Schedule => ({ yearly: at });

const JST = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function hm(at: string): [number, number] {
  const m = /^(\d{2}):(\d{2})$/.exec(at);
  if (!m) throw new Error(`bad time ${at}`);
  return [Number(m[1]), Number(m[2])];
}

/** The latest slot at or before `now` (every minute: the current minute). */
export function lastSlot(schedule: Schedule, now: Date): Date {
  if ("every" in schedule)
    return new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  // JST wall-clock fields, read with the UTC getters.
  const j = new Date(now.getTime() + JST);
  const y = j.getUTCFullYear();
  if ("daily" in schedule) {
    const [h, m] = hm(schedule.daily);
    let slot = Date.UTC(y, j.getUTCMonth(), j.getUTCDate(), h, m) - JST;
    if (slot > now.getTime()) slot -= DAY;
    return new Date(slot);
  }
  const d = /^(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(schedule.yearly);
  if (!d) throw new Error(`bad date ${schedule.yearly}`);
  const [h, m] = hm(d[3]);
  const at = (year: number) =>
    Date.UTC(year, Number(d[1]) - 1, Number(d[2]), h, m) - JST;
  const slot = at(y) <= now.getTime() ? at(y) : at(y - 1);
  return new Date(slot);
}
