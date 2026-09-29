/**
 * The website this app belongs to: its /api/mobile/v1 JSON API and the
 * pages shown in the web view. Set per build profile (eas.json). Without
 * it, development (Metro: Expo Go, development builds) uses the staging
 * site and release builds production; for a local server use e.g.
 * EXPO_PUBLIC_API_URL=http://192.168.1.10:3000 in .env.local.
 */
export const PRODUCTION_URL = "https://ais.kai-lab.net";
const STAGING_URL = "https://ais-dev.kai-lab.net";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  (__DEV__ ? STAGING_URL : PRODUCTION_URL)
).replace(/\/+$/, "");

/** Resolve a site-relative URL from the API ("/api/files?…") to absolute. */
export function absoluteUrl(url: string): string;
export function absoluteUrl(url: string | null | undefined): string | null;
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}
