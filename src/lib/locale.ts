import type { Locale } from "@contract/core";
import { getLocales } from "expo-localization";

/** Japanese if the phone prefers it, else English (before sign-in). */
export function deviceLocale(): Locale {
  const lang = getLocales()[0]?.languageCode?.toLowerCase();
  return lang === "ja" ? "ja" : "en";
}
