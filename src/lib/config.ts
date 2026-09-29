import { Platform } from "react-native";

/**
 * Two servers:
 *  - API_URL — this app's own server (Expo API routes, src/app/api): the
 *    /api/mobile/v1 JSON API, sign-in and notifications. On the web it's the
 *    page's own origin; native builds use ais-alumni(-dev).kai-lab.net.
 *  - SITE_URL — the website (Kuisin/ais-alumni-app), only for the pages it
 *    still has and the app doesn't: opened in the web view (onboarding
 *    forms, admin mode…), links into them, the privacy notice.
 * Development (Metro, and the web app on its -dev domain) uses the staging
 * pair, which shares the production database; release builds production.
 * Override with EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SITE_URL (.env.local).
 */
export const PRODUCTION_URL = "https://ais-alumni.kai-lab.net";
const STAGING_URL = "https://ais-alumni-dev.kai-lab.net";
const PRODUCTION_SITE = "https://ais.kai-lab.net";
const STAGING_SITE = "https://ais-dev.kai-lab.net";

const webOrigin =
  Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin
    : null;
const staging = __DEV__ || Boolean(webOrigin?.includes("ais-alumni-dev."));

const clean = (u: string) => u.replace(/\/+$/, "");

export const API_URL = clean(
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
    webOrigin ||
    (staging ? STAGING_URL : PRODUCTION_URL),
);

export const SITE_URL = clean(
  process.env.EXPO_PUBLIC_SITE_URL?.trim() ||
    (staging ? STAGING_SITE : PRODUCTION_SITE),
);

/**
 * Resolve a relative URL from the API ("/api/files?…", "/avatars/…") to
 * absolute: stored files and default avatars are served here too.
 */
export function absoluteUrl(url: string): string;
export function absoluteUrl(url: string | null | undefined): string | null;
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}
