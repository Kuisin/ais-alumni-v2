/**
 * The website's datetime-local values: "YYYY-MM-DDTHH:mm" in Japan time
 * (UTC+9, no daylight saving), "" = not set.
 */

const JST_MS = 9 * 60 * 60 * 1000;

/** A moment → "YYYY-MM-DDTHH:mm" (JST). */
export function toJstLocal(d: Date): string {
  return new Date(d.getTime() + JST_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" (JST) → the moment, or null. */
export function fromJstLocal(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The next full hour: a sensible starting point for a picker. */
export function nextHour(now = new Date()): Date {
  const d = new Date(now.getTime() + 60 * 60 * 1000);
  d.setUTCMinutes(0, 0, 0);
  return d;
}
