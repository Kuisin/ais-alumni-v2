import type { Locale } from "@contract/core";

/**
 * Dates as the website shows them (src/lib/format.ts): always Japan time,
 * since events and deadlines are in Japan.
 *   ja → 2026年10月3日（土） 14:00    en → Sat, Oct 3, 2026, 2:00 PM
 */
export const TIME_ZONE = "Asia/Tokyo";

type Input = Date | string | number;
const asDate = (d: Input) => (d instanceof Date ? d : new Date(d));

function partsJa(date: Date, withTime: boolean): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = `${get("year")}年${get("month")}月${get("day")}日（${get("weekday")}）`;
  return withTime ? `${day} ${get("hour")}:${get("minute")}` : day;
}

export function formatDateTime(d: Input, locale: Locale): string {
  const date = asDate(d);
  if (locale === "ja") return partsJa(date, true);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(d: Input, locale: Locale): string {
  const date = asDate(d);
  if (locale === "ja") return partsJa(date, false);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Time of day only: 14:00 / 2:00 PM. */
export function formatTime(d: Input, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: locale !== "ja",
  }).format(asDate(d));
}
