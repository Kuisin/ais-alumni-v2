import type { Locale } from "@contract/core";
import { TIME_ZONE } from "@/lib/format";

/**
 * Times in talks, as the website shows them (chat-list.tsx, chat-room.tsx):
 * always Japan time. `yesterday` / `today` are chat.room.* texts.
 */

const DAY = 86_400_000;

type Style = "time" | "monthDay" | "monthDayWeekday";
const OPTIONS: Record<Style, Intl.DateTimeFormatOptions> = {
  time: { hour: "2-digit", minute: "2-digit" },
  monthDay: { month: "numeric", day: "numeric" },
  monthDayWeekday: { month: "numeric", day: "numeric", weekday: "short" },
};

// Formatters are costly to create; a talk formats one per message.
const cache = new Map<string, Intl.DateTimeFormat>();
function format(iso: string, locale: Locale, style: Style): string {
  const key = `${locale}:${style}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
      timeZone: TIME_ZONE,
      ...OPTIONS[style],
    });
    cache.set(key, f);
  }
  return f.format(new Date(iso));
}

/** "2026-10-03" in Japan time. */
export function jstDay(iso: string | number): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000)
    .toISOString()
    .slice(0, 10);
}

/** 14:05 */
export function timeOfDay(iso: string, locale: Locale): string {
  return format(iso, locale, "time");
}

/** Talk list: 14:05 today, 昨日, else 10/3. */
export function listTime(
  iso: string,
  locale: Locale,
  yesterday: string,
): string {
  const day = jstDay(iso);
  if (day === jstDay(Date.now())) return timeOfDay(iso, locale);
  if (day === jstDay(Date.now() - DAY)) return yesterday;
  return format(iso, locale, "monthDay");
}

/** Date pill in a talk: 今日, 昨日, else 10/3(土). */
export function dayLabel(
  iso: string,
  locale: Locale,
  words: { today: string; yesterday: string },
): string {
  const day = jstDay(iso);
  if (day === jstDay(Date.now())) return words.today;
  if (day === jstDay(Date.now() - DAY)) return words.yesterday;
  return format(iso, locale, "monthDayWeekday");
}
