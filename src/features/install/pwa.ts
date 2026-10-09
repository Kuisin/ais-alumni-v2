import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { isInstalledWebApp } from "@/lib/web-push";

/**
 * The web app on this device: what kind of phone it is (which install
 * steps to show), and Chrome's "Install app" prompt for Android. Chrome
 * offers the prompt once per page load, usually before anyone reaches
 * /install — so it's caught here, when the app starts (the root layout
 * imports install-prompt.tsx), and kept for the button.
 */

export type InstallDevice = "ios" | "android" | "other";

/** The phone this page is open on (the apps: their own platform). */
export function installDevice(): InstallDevice {
  if (Platform.OS === "ios" || Platform.OS === "android") return Platform.OS;
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  // iPadOS says "Macintosh"; only it has a touch screen.
  if (
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  )
    return "ios";
  return "other";
}

/** Chrome's event (not in TypeScript's DOM types). */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type State = { canPrompt: boolean; installed: boolean };

let deferred: InstallPromptEvent | null = null;
let state: State = { canPrompt: false, installed: false };
const listeners = new Set<() => void>();

function update(next: Partial<State>) {
  state = { ...state, ...next };
  for (const fn of listeners) fn();
}

if (Platform.OS === "web" && typeof window !== "undefined") {
  state = { canPrompt: false, installed: isInstalledWebApp() };
  window.addEventListener("beforeinstallprompt", (event) => {
    // Our own button and steps instead of Chrome's bar.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    update({ canPrompt: true });
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    update({ canPrompt: false, installed: true });
  });
}

const SERVER: State = { canPrompt: false, installed: false };

/**
 * `canPrompt`: the browser can show its install dialog (Android Chrome,
 * not yet installed). `installed`: running from the home screen, or just
 * installed. `prompt()` shows the dialog; false = dismissed or unavailable.
 */
export function usePwaInstall(): State & { prompt: () => Promise<boolean> } {
  const current = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => SERVER,
  );
  return {
    ...current,
    prompt: async () => {
      const event = deferred;
      if (!event) return false;
      // Chrome allows one prompt() per event.
      deferred = null;
      update({ canPrompt: false });
      try {
        await event.prompt();
        return (await event.userChoice).outcome === "accepted";
      } catch {
        return false;
      }
    },
  };
}
