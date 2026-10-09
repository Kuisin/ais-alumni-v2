import type { PushRegisterRequest, PushState } from "@contract/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Linking, Platform } from "react-native";
import { useTranslations } from "use-intl";
import { api, isApiError } from "./api";
import { ME_KEY, useAuth } from "./auth";
import { getDeviceItem, removeDeviceItem, setDeviceItem } from "./device-store";
import { hrefFor, nativeHref, siteUrl } from "./links";
import {
  ACTION,
  CATEGORY,
  easProjectId,
  notificationOpened,
  onActionDone,
  onNotificationOpen,
  type PushUnavailable,
  pushUnavailable,
  rememberLocale,
  setCurrentScreen,
  setScreenResolver,
} from "./push-core";
import {
  askWebPermission,
  listenToWebPush,
  removeWebSubscription,
  setWebBadge,
  takeLaunchTap,
  webPermission,
  webPushSupported,
  webSubscription,
} from "./web-push";

/**
 * App notifications, the React side (the rest is push-core.ts):
 * - asks for permission when the member turns them on, registers this
 *   device's Expo push token with the server (PUT /push), and keeps it
 *   registered (token changes, next launches) unless they turned it off;
 * - Android channels (one per notification category) and the quick actions
 *   (chat reply / mark read, follow request accept / decline), named in the
 *   member's language;
 * - opens what a tapped notification is about (natively where possible)
 *   and records the read receipt (POST /notifications/open);
 * - keeps the app icon's number in step with the tab bar, and refreshes
 *   lists when a notification arrives.
 * Screens use usePush() (settings, the prompt on Home, onboarding).
 *
 * The web app does the same through the browser (Web Push, web-push.ts):
 * its permission, a push subscription instead of an Expo token, and the
 * service worker (public/sw.js) for what arrives and what's tapped. No
 * channels or quick actions there, and no first-launch intro.
 */

export const PUSH_KEY = ["push"] as const;
export const INBOX_KEY = ["notifications"] as const;

/** What stops notifications on this device (null = nothing). */
export type PushBlocker =
  | PushUnavailable
  /** no EAS project id in this build, and the server has no dev outbox;
   *  the web app: the server has no Web Push key */
  | "not-configured";

export type PushPermission = "granted" | "denied" | "undetermined";

type Ctx = {
  /** null when this device can get notifications */
  blocker: PushBlocker;
  /** null until known */
  permission: PushPermission | null;
  /** the OS won't ask again: only the system settings can turn it on */
  canAskAgain: boolean;
  /** registered with the server, switched on, and allowed by the OS */
  enabled: boolean;
  /** the member turned them off here (settings): don't suggest them */
  optedOut: boolean;
  state: PushState | null;
  busy: boolean;
  /** the phone's permission dialog only; signing in registers the device */
  askPermission: () => Promise<PushPermission>;
  /** ask the OS (first time) and register; "denied" = open settings */
  enable: () => Promise<"ok" | "denied" | "unavailable" | "failed">;
  disable: () => Promise<void>;
  sendTest: () => Promise<"ok" | "too_soon" | "failed">;
  openSettings: () => void;
};

const PushContext = createContext<Ctx | null>(null);

const OPT_OUT_KEY = "ais.pushOptOut";
/** The first-launch intro was shown (AsyncStorage: gone with the app). */
const INTRO_KEY = "ais.pushIntroShown";
const INSTALL_KEY = "ais.installId";

async function installId(): Promise<string> {
  const known = await SecureStore.getItemAsync(INSTALL_KEY).catch(() => null);
  if (known) return known;
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await SecureStore.setItemAsync(INSTALL_KEY, id).catch(() => {});
  return id;
}

/** How long to wait for the push token before giving up. */
const TOKEN_TIMEOUT_MS = 20_000;

/** `promise`, or a rejection after `ms` (the OS or Expo never answered). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * This install's Expo push token. Gives up after TOKEN_TIMEOUT_MS: iOS
 * asks APNs for the device token and Expo's servers for the push token, and
 * either can stay silent (no network, APNs unavailable) — the button that
 * turned notifications on must not spin forever. Builds without an EAS project (local
 * development) use a made-up "dev" token when the server writes pushes to
 * its outbox (EXPO_PUSH_OUTBOX=1); otherwise there is none.
 */
async function currentToken(devTokens: boolean): Promise<string | null> {
  const projectId = easProjectId();
  if (projectId)
    return (
      await withTimeout(
        Notifications.getExpoPushTokenAsync({ projectId }),
        TOKEN_TIMEOUT_MS,
      )
    ).data;
  if (__DEV__ && devTokens)
    return `ExponentPushToken[dev-${await installId()}]`;
  return null;
}

function permissionOf(
  p: Notifications.NotificationPermissionsStatus,
): PushPermission {
  if (p.granted) return "granted";
  if (Platform.OS === "ios") {
    const s = p.ios?.status;
    if (
      s === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      s === Notifications.IosAuthorizationStatus.EPHEMERAL ||
      s === Notifications.IosAuthorizationStatus.AUTHORIZED
    )
      return "granted";
  }
  return p.status === "denied" ? "denied" : "undetermined";
}

const CATEGORIES = [
  "account",
  "news",
  "events",
  "chat",
  "social",
  "family",
  "profile",
  "admin",
] as const;

export function PushProvider({ children }: { children: ReactNode }) {
  const { status, me, locale } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const navReady = Boolean(useRootNavigationState()?.key);
  const tn = useTranslations("notifications.categories");
  const ta = useTranslations("mobile.push.actions");
  const signedIn = status === "signedIn";
  const active = signedIn && me?.user.state === "ACTIVE";
  const unavailable = pushUnavailable();
  // The web app in a browser that can subscribe ("web" otherwise blocks).
  const webPush = useMemo(() => webPushSupported(), []);

  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [busy, setBusy] = useState(false);
  const [optOut, setOptOut] = useState<boolean | null>(null);

  const query = useQuery({
    queryKey: PUSH_KEY,
    enabled: signedIn && (unavailable === null || webPush),
    queryFn: () => api<PushState>("/push"),
    staleTime: 60_000,
  });
  const state = signedIn ? (query.data ?? null) : null;
  const blocker: PushBlocker = webPush
    ? state && !state.webPushKey
      ? "not-configured"
      : null
    : (unavailable ??
      (state && !easProjectId() && !(__DEV__ && state.devTokens)
        ? "not-configured"
        : null));

  // Keep a chat's banner quiet while that chat is open (push-core).
  useEffect(() => {
    setScreenResolver((path) => {
      const site = siteUrl(path);
      const href = site ? nativeHref(site.path, site.query) : null;
      return typeof href === "string" ? href : null;
    });
  }, []);
  const here = useRef(pathname);
  useEffect(() => {
    here.current = pathname;
    setCurrentScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    void getDeviceItem(OPT_OUT_KEY).then((v) => setOptOut(v === "1"));
  }, []);

  const readPermission = useCallback(async () => {
    if (webPush) {
      const p = webPermission();
      setPermission(p);
      // A browser asks once; after "block" only its site settings help.
      setCanAskAgain(p !== "denied");
    }
    if (unavailable === "web") return;
    const p = await Notifications.getPermissionsAsync().catch(() => null);
    if (!p) return;
    setPermission(permissionOf(p));
    setCanAskAgain(p.canAskAgain);
  }, [unavailable, webPush]);
  useEffect(() => {
    void readPermission();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void readPermission();
    });
    return () => sub.remove();
  }, [readPermission]);

  // First launch after install: before the phone's own dialog (the OS asks
  // only once — "undetermined" until then), a screen says what
  // notifications bring (src/app/notifications-intro.tsx), once per install
  // and once sign-in state is known. Signing in later registers the device
  // (the sync below).
  const introShown = useRef(false);
  useEffect(() => {
    if (
      introShown.current ||
      unavailable !== null ||
      !navReady ||
      status === "loading" ||
      permission !== "undetermined" ||
      !canAskAgain ||
      optOut !== false
    )
      return;
    introShown.current = true;
    let cancelled = false;
    void AsyncStorage.getItem(INTRO_KEY)
      .catch(() => null)
      .then((seen) => {
        if (seen || cancelled) return;
        void AsyncStorage.setItem(INTRO_KEY, "1").catch(() => {});
        router.push("/notifications-intro");
      });
    return () => {
      cancelled = true;
    };
  }, [unavailable, navReady, status, permission, canAskAgain, optOut, router]);

  /** The phone's permission dialog only (the intro screen's button). */
  const askPermission = useCallback(async (): Promise<PushPermission> => {
    if (webPush) {
      const p = await askWebPermission();
      setPermission(p);
      setCanAskAgain(p !== "denied");
      return p;
    }
    try {
      const p = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      setPermission(permissionOf(p));
      setCanAskAgain(p.canAskAgain);
      return permissionOf(p);
    } catch (e) {
      console.warn("[push] permission request failed", e);
      return "undetermined";
    }
  }, [webPush]);

  // Android channels and the quick actions, in the member's language.
  useEffect(() => {
    if (unavailable === "web") return;
    void rememberLocale(locale);
    if (Platform.OS === "android")
      for (const c of CATEGORIES)
        void Notifications.setNotificationChannelAsync(c, {
          name: tn(c),
          importance:
            c === "chat" || c === "account"
              ? Notifications.AndroidImportance.HIGH
              : Notifications.AndroidImportance.DEFAULT,
          lightColor: "#1e3a8a",
        }).catch(() => {});
    void Notifications.setNotificationCategoryAsync(CATEGORY.chat, [
      {
        identifier: ACTION.reply,
        buttonTitle: ta("reply"),
        textInput: {
          placeholder: ta("replyPlaceholder"),
          submitButtonTitle: ta("replySend"),
        },
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION.read,
        buttonTitle: ta("markRead"),
        options: { opensAppToForeground: false },
      },
    ]).catch(() => {});
    void Notifications.setNotificationCategoryAsync(CATEGORY.followRequest, [
      {
        identifier: ACTION.accept,
        buttonTitle: ta("accept"),
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION.decline,
        buttonTitle: ta("decline"),
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]).catch(() => {});
  }, [locale, tn, ta, unavailable]);

  // One registration at a time: a call while one runs gets its result.
  const registering = useRef<Promise<boolean> | null>(null);
  const register = useCallback((): Promise<boolean> => {
    if (registering.current) return registering.current;
    const run = async (): Promise<boolean> => {
      const s = queryClient.getQueryData<PushState>(PUSH_KEY);
      let body: PushRegisterRequest;
      if (webPush) {
        const subscription = s?.webPushKey
          ? await webSubscription(s.webPushKey).catch((e) => {
              console.warn("[push] no subscription", e);
              return null;
            })
          : null;
        if (!subscription) return false;
        body = { platform: "web", subscription, enabled: true };
      } else {
        const token = await currentToken(Boolean(s?.devTokens)).catch((e) => {
          console.warn("[push] no token", e);
          return null;
        });
        if (!token) return false;
        body = {
          token,
          platform: Platform.OS === "android" ? "android" : "ios",
          enabled: true,
        };
      }
      try {
        const next = await api<PushState>("/push", { method: "PUT", body });
        queryClient.setQueryData(PUSH_KEY, next);
        return true;
      } catch (e) {
        console.warn("[push] register failed", e);
        return false;
      }
    };
    const p = run().finally(() => {
      registering.current = null;
    });
    registering.current = p;
    return p;
  }, [queryClient, webPush]);

  // Keep the server in step with this device: register on every launch
  // (tokens can change) while the OS allows notifications and the member
  // hasn't turned them off here; unregister when the OS setting was turned
  // off, so LINE / email take over again.
  const syncedFor = useRef<string | null>(null);
  useEffect(() => {
    if (
      !signedIn ||
      !me ||
      blocker !== null ||
      permission === null ||
      optOut === null ||
      !state
    )
      return;
    const want = permission === "granted" && !optOut;
    const key = `${me.user.id}:${want}`;
    if (syncedFor.current === key) return;
    syncedFor.current = key;
    // A failed request is tried again when the state is next refetched.
    if (want)
      void register().then((ok) => {
        if (!ok) syncedFor.current = null;
      });
    else if (permission === "denied" && state.device)
      void api<PushState>("/push", { method: "DELETE" })
        .then((next) => queryClient.setQueryData(PUSH_KEY, next))
        .catch(() => {
          syncedFor.current = null;
        });
  }, [signedIn, me, blocker, permission, optOut, state, register, queryClient]);
  useEffect(() => {
    if (!signedIn) syncedFor.current = null;
  }, [signedIn]);

  // A new device token (APNs / FCM rotated it): register again. Asking for
  // the Expo push token reports the device token here too, so only a token
  // that differs from the last one counts — otherwise every registration
  // would start the next one, forever.
  const deviceToken = useRef<string | null>(null);
  useEffect(() => {
    if (unavailable !== null) return;
    const sub = Notifications.addPushTokenListener(({ data }) => {
      const next = typeof data === "string" ? data : JSON.stringify(data);
      const changed =
        deviceToken.current !== null && deviceToken.current !== next;
      deviceToken.current = next;
      if (changed && signedIn && optOut === false && permission === "granted")
        void register();
    });
    return () => sub.remove();
  }, [unavailable, signedIn, optOut, permission, register]);

  // Open what a tapped notification is about, once the app can navigate.
  // Accounts not yet approved stay on onboarding, which shows their state.
  useEffect(() => {
    if (!signedIn || !navReady) return;
    return onNotificationOpen((data) => {
      if (data.receipt)
        void api("/notifications/open", { body: { token: data.receipt } })
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: INBOX_KEY });
            void queryClient.invalidateQueries({ queryKey: ME_KEY });
          })
          .catch(() => {});
      if (!active) {
        void queryClient.invalidateQueries({ queryKey: ME_KEY });
        return;
      }
      if (!data.path) return;
      const href = hrefFor(data.path);
      if (href && href !== here.current) router.push(href);
    });
  }, [signedIn, active, navReady, router, queryClient]);

  // The web app, opened by tapping a notification: once / has redirected.
  useEffect(() => {
    if (!webPush || !signedIn || !navReady || pathname === "/") return;
    const tap = takeLaunchTap();
    if (tap) notificationOpened(tap);
  }, [webPush, signedIn, navReady, pathname]);

  // A notification arrived, or a quick action ran: refresh what it touches.
  useEffect(() => {
    if (unavailable !== null && !webPush) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
      void queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      void queryClient.invalidateQueries({ queryKey: ["news", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["follows"] });
    };
    // The web app: the service worker reports arrivals and taps.
    if (webPush)
      return listenToWebPush({
        onOpen: notificationOpened,
        onReceived: refresh,
      });
    const sub = Notifications.addNotificationReceivedListener(refresh);
    const off = onActionDone(refresh);
    return () => {
      sub.remove();
      off();
    };
  }, [unavailable, webPush, queryClient]);

  // The app icon's number = the tab bar's.
  const badge = me
    ? me.badges.news + me.badges.messages + me.badges.chat + me.badges.follows
    : 0;
  useEffect(() => {
    if (unavailable === "web") {
      setWebBadge(signedIn ? badge : 0);
      return;
    }
    void Notifications.setBadgeCountAsync(signedIn ? badge : 0).catch(() => {});
  }, [unavailable, signedIn, badge]);

  const enable = useCallback(async () => {
    if (blocker) return "unavailable" as const;
    setBusy(true);
    try {
      await removeDeviceItem(OPT_OUT_KEY);
      setOptOut(false);
      if (webPush) {
        let w = webPermission();
        if (w === "undetermined") w = await askWebPermission();
        setPermission(w);
        setCanAskAgain(w !== "denied");
        if (w !== "granted") return "denied" as const;
        if (me) syncedFor.current = `${me.user.id}:true`;
        return (await register()) ? ("ok" as const) : ("failed" as const);
      }
      let p = await Notifications.getPermissionsAsync();
      if (permissionOf(p) !== "granted" && p.canAskAgain)
        p = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
      setPermission(permissionOf(p));
      setCanAskAgain(p.canAskAgain);
      if (permissionOf(p) !== "granted") return "denied" as const;
      if (me) syncedFor.current = `${me.user.id}:true`;
      return (await register()) ? ("ok" as const) : ("failed" as const);
    } finally {
      setBusy(false);
    }
  }, [blocker, register, me, webPush]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await setDeviceItem(OPT_OUT_KEY, "1");
      setOptOut(true);
      const next = await api<PushState>("/push", { method: "DELETE" });
      queryClient.setQueryData(PUSH_KEY, next);
      if (webPush) await removeWebSubscription();
    } catch (e) {
      console.warn("[push] unregister failed", e);
    } finally {
      setBusy(false);
    }
  }, [queryClient, webPush]);

  const sendTest = useCallback(async () => {
    try {
      await api("/push/test", { method: "POST" });
      return "ok" as const;
    } catch (e) {
      return isApiError(e, "too_soon")
        ? ("too_soon" as const)
        : ("failed" as const);
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      blocker,
      permission,
      canAskAgain,
      enabled: Boolean(
        state?.device?.enabled &&
          !state.device.failed &&
          permission === "granted",
      ),
      optedOut: optOut === true,
      state,
      busy,
      askPermission,
      enable,
      disable,
      sendTest,
      openSettings: () => void Linking.openSettings(),
    }),
    [
      blocker,
      permission,
      canAskAgain,
      optOut,
      state,
      busy,
      askPermission,
      enable,
      disable,
      sendTest,
    ],
  );
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePush(): Ctx {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error("usePush outside PushProvider");
  return ctx;
}
