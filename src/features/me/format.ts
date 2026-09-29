import type { HistoryEducation, HistoryWork } from "@contract/account";
import type { Locale } from "@contract/core";

/**
 * A birth date ("YYYY-MM-DD", a calendar day) as the website shows it
 * (formatBirthDate in src/components/profile/birth-date-card.tsx):
 * 1996年4月2日 / April 2, 1996.
 */
export function formatBirthDate(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** 2014–2018 / 2020–現在, as the website's HistoryList. */
export function historyYears(
  e: Pick<HistoryEducation | HistoryWork, "startYear" | "endYear" | "ongoing">,
  present: string,
): string {
  const end = e.ongoing && e.endYear === null ? present : (e.endYear ?? "");
  return `${e.startYear ?? ""}–${end}`;
}
