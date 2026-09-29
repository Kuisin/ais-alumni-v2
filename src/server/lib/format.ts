import type { Locale } from "@/server/generated/prisma/enums";

export const TIME_ZONE = "Asia/Tokyo";

/**
 * ja → 2026年10月3日（土） 14:00
 * en → Sat, Oct 3, 2026, 2:00 PM
 */
export function formatDateTime(date: Date, locale: Locale): string {
  if (locale === "ja") {
    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}年${get("month")}月${get("day")}日（${get("weekday")}） ${get("hour")}:${get("minute")}`;
  }
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

/** Date only: ja → 2026年10月3日（土）, en → Sat, Oct 3, 2026 */
export function formatDate(date: Date, locale: Locale): string {
  if (locale === "ja") {
    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}年${get("month")}月${get("day")}日（${get("weekday")}）`;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Parse a `<input type="datetime-local">` value as JST and return UTC (§10.3:
 * "JST stored as UTC"). JST has no DST so a fixed +09:00 offset is exact.
 */
export function parseJstLocal(value: string): Date {
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return new Date(`${withSeconds}+09:00`);
}

/** Inverse of parseJstLocal: UTC Date → "YYYY-MM-DDTHH:mm" in JST. */
export function toJstLocalInput(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 16);
}

/** ja shows kanji/kana if present, else romaji; en shows romaji (§12). */
/**
 * The name shown across the app: the romaji name ("Last, First") in every
 * language, so members are listed the same way for everyone. The kanji name
 * is shown as secondary text where there is room. `locale` is kept for
 * callers; it no longer changes the result.
 */
export function displayName(
  user: { nameRomaji: string | null; nameKanji: string | null },
  _locale?: Locale,
): string {
  return user.nameRomaji ?? user.nameKanji ?? "—";
}

/**
 * The names besides displayName(): 漢字 with its フリガナ, e.g.
 * "山田 太郎（ヤマダ タロウ）" — or just the フリガナ when the kanji name is
 * the display name. Null when nothing else is recorded.
 */
export function otherNames(user: {
  nameRomaji: string | null;
  nameKanji: string | null;
  nameKana?: string | null;
}): string | null {
  const kana = user.nameKana?.trim() || null;
  if (!user.nameRomaji) return kana;
  const kanji = user.nameKanji?.trim() || null;
  if (kanji && kana) return `${kanji}（${kana}）`;
  return kanji ?? kana;
}

/**
 * Pick the locale's version of admin-authored content, falling back to the
 * other language with a flag so the UI can show "(English only)" (§12).
 */
export function localized(
  ja: string | null | undefined,
  en: string | null | undefined,
  locale: Locale,
): { text: string; fallback: "ja" | "en" | null } {
  const preferred = locale === "ja" ? ja : en;
  if (preferred?.trim()) return { text: preferred, fallback: null };
  const other = locale === "ja" ? en : ja;
  if (other?.trim())
    return { text: other, fallback: locale === "ja" ? "en" : "ja" };
  return { text: "", fallback: null };
}
