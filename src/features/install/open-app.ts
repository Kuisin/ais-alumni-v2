import { Platform } from "react-native";
import { APP_SCHEME } from "@/lib/app-store";
import { installDevice } from "./pwa";

/**
 * Opening this web page in the iPhone app. Safari does it with its own
 * Smart App Banner (src/app/+html.tsx); every other browser on an iPhone
 * (Chrome, LINE's and Instagram's in-app browsers, …) has no such banner,
 * so the web app shows its own 「アプリで開く」 (install-prompt.tsx).
 */

/** Browsers on iOS that aren't Safari say so in the user agent. */
const NOT_SAFARI =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\/|YaBrowser|Line\/|FBAN|FBAV|FB_IAB|Instagram|Twitter|MicroMessenger|YJApp|Gmail|Slack/i;

/** Safari on an iPhone or iPad: it shows the Smart App Banner itself. */
export function isIosSafari(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  if (installDevice() !== "ios") return false;
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !NOT_SAFARI.test(ua);
}

/**
 * This page in the app, through its URL scheme: aisalumni://news/123 opens
 * the same screen (Expo Router maps the path; src/app/+native-intent.tsx).
 * A universal link can't do it here — iOS never opens one from a page on
 * the same site. Without the app installed nothing happens, which is why
 * the banner offers the App Store next to it.
 */
export function appUrlFor(path: string): string {
  return `${APP_SCHEME}://${path.replace(/^\/+/, "")}`;
}

export function openInApp(path: string) {
  if (typeof window === "undefined") return;
  window.location.href = appUrlFor(path);
}
