import type { PushData, PushRegisterRequest } from "@contract/notifications";
import { Platform } from "react-native";

/**
 * Notifications in the web app (Web Push), the browser side: Android's
 * Chrome and an installed web app ("Install app"), and desktop browsers.
 * The service worker (public/sw.js, registered by src/app/+html.tsx) shows
 * what the server sends (src/server/lib/push/web.ts) and tells this page
 * about arrivals and taps; push.tsx uses these helpers on the web where it
 * uses expo-notifications in the apps.
 */

type Permission = "granted" | "denied" | "undetermined";

/** This browser can subscribe (iOS Safari: only once added to the Home Screen). */
export function webPushSupported(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Opened from the home screen icon (installed), not a browser tab. */
export function isInstalledWebApp(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function webPermission(): Permission {
  if (!webPushSupported()) return "denied";
  const p = Notification.permission;
  return p === "default" ? "undetermined" : p;
}

export async function askWebPermission(): Promise<Permission> {
  if (!webPushSupported()) return "denied";
  const p = await Notification.requestPermission().catch(() => "default");
  return p === "default" ? "undetermined" : (p as Permission);
}

/** The VAPID public key (base64url) as the bytes subscribe() takes. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const b64 = key.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * This browser's subscription, made if there isn't one (the permission
 * must already be granted). A subscription made with another server key
 * can't be used: it's replaced.
 */
export async function webSubscription(
  serverKey: string,
): Promise<Extract<PushRegisterRequest, { platform: "web" }>["subscription"]> {
  const registration = await navigator.serviceWorker.ready;
  const options = {
    userVisibleOnly: true,
    applicationServerKey: keyBytes(serverKey),
  };
  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe(options);
  } else {
    const current = sub.options.applicationServerKey;
    const same =
      current &&
      btoa(String.fromCharCode(...new Uint8Array(current))) ===
        btoa(String.fromCharCode(...options.applicationServerKey));
    if (!same) {
      await sub.unsubscribe().catch(() => {});
      sub = await registration.pushManager.subscribe(options);
    }
  }
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error("no subscription");
  return { endpoint: json.endpoint, keys: { p256dh, auth } };
}

/** This browser stops receiving (the server forgets it separately). */
export async function removeWebSubscription(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = await registration?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {
    // Nothing to remove.
  }
}

const isPushData = (d: unknown): d is PushData =>
  Boolean(
    d &&
      typeof d === "object" &&
      (d as PushData).v === 1 &&
      typeof (d as PushData).kind === "string",
  );

/** Taps and arrivals reported by the service worker, while a page is open. */
export function listenToWebPush(handlers: {
  onOpen: (data: PushData) => void;
  onReceived: () => void;
}): () => void {
  if (!webPushSupported()) return () => {};
  const listener = (event: MessageEvent) => {
    const message = event.data as { type?: string; data?: unknown } | null;
    if (message?.type === "ais-push-received") handlers.onReceived();
    else if (message?.type === "ais-push-open" && isPushData(message.data))
      handlers.onOpen(message.data);
  };
  navigator.serviceWorker.addEventListener("message", listener);
  return () => navigator.serviceWorker.removeEventListener("message", listener);
}

// Read when this module loads — before the router replaces the address.
let launchTap: PushData | null = readLaunchTap();

function readLaunchTap(): PushData | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("push");
    if (!raw) return null;
    url.searchParams.delete("push");
    window.history.replaceState(window.history.state, "", url);
    const data: unknown = JSON.parse(raw);
    return isPushData(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * The tap that opened the app (public/sw.js opens /?push=<data>), once.
 * Take it after the start page has moved on (/ redirects to Home), or that
 * redirect replaces the screen the tap opened.
 */
export function takeLaunchTap(): PushData | null {
  const tap = launchTap;
  launchTap = null;
  return tap;
}

/** The home-screen icon's number (installed web app; elsewhere nothing). */
export function setWebBadge(count: number): void {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return;
  const nav = navigator as {
    setAppBadge?: (n: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  void (count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.())?.catch(
    () => {},
  );
}
