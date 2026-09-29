import type { PushData } from "@contract/notifications";
import enMobile from "@messages/en/mobile.json";
import jaMobile from "@messages/ja/mobile.json";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { API_URL } from "./config";
import { loadToken } from "./token-store";

/**
 * Push notifications, the part that runs without React — imported first
 * by the root layout, because iOS delivers a tap that launched the app to
 * a listener registered at module scope, and Android runs quick actions
 * (reply, accept…) in a background task defined here even when the app
 * isn't running. The React side (registration, navigation, badges, the
 * settings hook) is src/lib/push.tsx.
 *
 * What a push carries: PushData (src/lib/push/message.ts on the server).
 */

export const TASK = "ais-notification-actions";

/** Interactive categories (the server's PUSH_CATEGORY_IDS). */
export const CATEGORY = {
  chat: "chat_message",
  followRequest: "follow_request",
} as const;
export const ACTION = {
  reply: "reply",
  read: "read",
  accept: "accept",
  decline: "decline",
} as const;

/** Why this build can't get push notifications (null = it can). */
export type PushUnavailable = "web" | "expo-go" | null;

export function pushUnavailable(): PushUnavailable {
  if (Platform.OS === "web") return "web";
  if (isRunningInExpoGo()) return "expo-go";
  return null;
}

export function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export function pushData(n: Notifications.Notification): PushData | null {
  const d = n.request.content.data as Partial<PushData> | undefined;
  return d && d.v === 1 && typeof d.kind === "string" ? (d as PushData) : null;
}

// ---- which screen is open (to keep a chat's banner quiet inside it) ----

let currentScreen: string | null = null;
/** The app page for a push's path ("/app/chat/x" → "/chat/x"), set by push.tsx. */
let screenForPath: (path: string) => string | null = () => null;

export function setCurrentScreen(path: string | null): void {
  currentScreen = path;
}
export function setScreenResolver(fn: (path: string) => string | null): void {
  screenForPath = fn;
}

// Shown while the app is open, except a chat's messages inside that chat
// (they appear in the room anyway).
if (pushUnavailable() !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const data = pushData(n);
      const here = Boolean(
        data?.category === "chat" &&
          data.path &&
          currentScreen &&
          screenForPath(data.path) === currentScreen,
      );
      return {
        shouldShowBanner: !here,
        shouldShowList: !here,
        shouldPlaySound: !here,
        shouldSetBadge: true,
      };
    },
  });
}

// ---- taps and quick actions ----

type OpenListener = (data: PushData) => void;
const pendingOpens: PushData[] = [];
const openListeners = new Set<OpenListener>();
const handled = new Set<string>();
type DoneListener = (data: PushData) => void;
const doneListeners = new Set<DoneListener>();

/** Taps waiting for the app to be ready (push.tsx drains them). */
export function onNotificationOpen(fn: OpenListener): () => void {
  openListeners.add(fn);
  while (pendingOpens.length) {
    const next = pendingOpens.shift();
    if (next) fn(next);
  }
  return () => {
    openListeners.delete(fn);
  };
}

/** A quick action finished (to refresh lists and badges). */
export function onActionDone(fn: DoneListener): () => void {
  doneListeners.add(fn);
  return () => {
    doneListeners.delete(fn);
  };
}

async function authedPost(path: string, body?: unknown): Promise<boolean> {
  const token = await loadToken().catch(() => null);
  if (!token) return false;
  try {
    const res = await fetch(`${API_URL}/api/mobile/v1${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Remembered by push.tsx so background notices use the member's language. */
const LOCALE_KEY = "ais.locale";
export async function rememberLocale(locale: "ja" | "en"): Promise<void> {
  await SecureStore.setItemAsync(LOCALE_KEY, locale).catch(() => {});
}

/** The texts from messages/<locale>/mobile.json (push.failed). */
const FAILED = { ja: jaMobile.push.failed, en: enMobile.push.failed };

async function tellFailed(data: PushData, reply: boolean): Promise<void> {
  const stored = await SecureStore.getItemAsync(LOCALE_KEY).catch(() => null);
  const t = FAILED[stored === "en" ? "en" : "ja"];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t.title,
      body: reply ? t.reply : t.action,
      // Tapping it opens what the original was about.
      data: { ...data, receipt: undefined } satisfies PushData,
    },
    trigger: null,
  }).catch(() => {});
}

/**
 * Run a quick action (reply / mark read / accept / decline) straight away —
 * also in the background. Returns false for a plain tap (to open).
 */
async function performAction(
  response: Notifications.NotificationResponse,
  data: PushData,
): Promise<boolean> {
  const id = data.refId;
  let ok: boolean;
  switch (response.actionIdentifier) {
    case ACTION.reply: {
      const text = response.userText?.trim();
      if (!id || !text) return true;
      ok = await authedPost(`/chat/${encodeURIComponent(id)}/messages`, {
        body: text.slice(0, 2000),
      });
      if (ok) await authedPost(`/chat/${encodeURIComponent(id)}/read`);
      if (!ok) await tellFailed(data, true);
      break;
    }
    case ACTION.read:
      ok = id
        ? await authedPost(`/chat/${encodeURIComponent(id)}/read`)
        : false;
      break;
    case ACTION.accept:
    case ACTION.decline:
      ok = id
        ? await authedPost(
            `/follows/requests/${encodeURIComponent(id)}/${response.actionIdentifier}`,
          )
        : false;
      if (!ok) await tellFailed(data, false);
      break;
    default:
      return false;
  }
  await Notifications.dismissNotificationAsync(
    response.notification.request.identifier,
  ).catch(() => {});
  if (ok) for (const fn of doneListeners) fn(data);
  return true;
}

/** Every tap / action, once (the listener and the task may both see it). */
export async function handleResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
  if (handled.has(key)) return;
  handled.add(key);
  const data = pushData(response.notification);
  if (!data) return;
  if (await performAction(response, data)) return;
  if (openListeners.size) for (const fn of openListeners) fn(data);
  else pendingOpens.push(data);
}

if (pushUnavailable() === null) {
  Notifications.addNotificationResponseReceivedListener((r) => {
    void handleResponse(r);
  });
  // The tap that launched the app (cleared, so a reload doesn't repeat it).
  const launched = Notifications.getLastNotificationResponse();
  if (launched) {
    Notifications.clearLastNotificationResponse();
    void handleResponse(launched);
  }
  // Android: quick actions while the app is in the background or closed
  // (iOS hands them to the listener above, waking the app as needed).
  if (Platform.OS === "android") {
    TaskManager.defineTask<Notifications.NotificationTaskPayload>(
      TASK,
      async ({ data }) => {
        if (data && "actionIdentifier" in data) await handleResponse(data);
      },
    );
    Notifications.registerTaskAsync(TASK).catch((e) =>
      console.warn("[push] background task not registered", e),
    );
  }
}
