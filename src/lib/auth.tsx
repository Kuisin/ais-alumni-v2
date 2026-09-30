import type {
  Device as DeviceInfo,
  Locale,
  Me,
  SessionResult,
} from "@contract/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import { ApiError, api, setApiSession, setUnauthorizedHandler } from "./api";
import { API_URL } from "./config";
import { lineSdkSignIn } from "./line-sdk";
import { deviceLocale } from "./locale";
import { clearToken, loadToken, saveToken } from "./token-store";

/**
 * Who is signed in. The bearer token is kept in the keychain; `me` (account
 * state, language, badges, realtime channels) comes from GET /me and is
 * refetched when the app returns to the foreground or a signal arrives.
 *
 * status: loading → signedOut | signedIn | unreachable (token kept, but the
 * server couldn't be reached — the app offers a retry).
 */

export type AuthStatus = "loading" | "signedOut" | "signedIn" | "unreachable";

type Ctx = {
  status: AuthStatus;
  me: Me | null;
  token: string | null;
  /** UI language: the member's setting once signed in, else the device's */
  locale: Locale;
  setGuestLocale: (locale: Locale) => void;
  finishSignIn: (result: SessionResult) => Promise<void>;
  /**
   * LINE: through the LINE app (LINE SDK) when this build has it and the
   * server gave `lineChannelId`, else in the browser.
   */
  signInWithProvider: (
    provider: "google" | "line",
    options?: { lineChannelId?: string | null },
  ) => Promise<"ok" | "cancelled" | "failed">;
  /** Web: finish a LINE / Google sign-in on return to /auth?code=… */
  completeWebSignIn: (code: string) => Promise<"ok" | "failed">;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export const ME_KEY = ["me"] as const;

/** Web sign-in: the PKCE verifier kept for the return to /auth. */
const WEB_VERIFIER_KEY = "ais.oauth.verifier";

function device(): DeviceInfo {
  return {
    platform: Platform.OS,
    deviceName: Device.deviceName ?? Device.modelName ?? undefined,
  };
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE (S256) pair for the Google / LINE sign-in round trip. */
async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(Crypto.getRandomBytes(32));
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  const challenge = digest
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { verifier, challenge };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // undefined = not read from the keychain yet
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [guestLocale, setGuestLocale] = useState<Locale>(deviceLocale);

  useEffect(() => {
    loadToken()
      .then((t) => setToken(t))
      .catch(() => setToken(null));
  }, []);

  const forget = useCallback(async () => {
    setApiSession(null, guestLocale);
    setToken(null);
    queryClient.clear();
    await clearToken().catch(() => {});
  }, [queryClient, guestLocale]);

  useEffect(() => {
    setUnauthorizedHandler(() => void forget());
    return () => setUnauthorizedHandler(null);
  }, [forget]);

  const meQuery = useQuery({
    queryKey: ME_KEY,
    enabled: Boolean(token),
    queryFn: () => api<Me>("/me"),
    staleTime: 15_000,
  });
  const me = token ? (meQuery.data ?? null) : null;
  const locale: Locale = me?.user.locale ?? guestLocale;

  // Keep the API client's session in step (token first, before any query).
  if (token !== undefined) setApiSession(token, locale);

  const status: AuthStatus =
    token === undefined
      ? "loading"
      : token === null
        ? "signedOut"
        : me
          ? "signedIn"
          : meQuery.error instanceof ApiError && meQuery.error.status !== 401
            ? "unreachable"
            : "loading";

  const finishSignIn = useCallback(
    async (result: SessionResult) => {
      await saveToken(result.token);
      setApiSession(result.token, result.me.user.locale);
      queryClient.setQueryData(ME_KEY, result.me);
      setToken(result.token);
    },
    [queryClient],
  );

  const signInWithProvider = useCallback(
    async (
      provider: "google" | "line",
      options?: { lineChannelId?: string | null },
    ) => {
      if (provider === "line" && options?.lineChannelId) {
        const line = await lineSdkSignIn(options.lineChannelId);
        if (line.type === "cancelled") return "cancelled" as const;
        if (line.type === "ok") {
          try {
            const result = await api<SessionResult>("/auth/line/native", {
              body: {
                accessToken: line.accessToken,
                locale: guestLocale,
                device: device(),
              },
            });
            await finishSignIn(result);
            return "ok" as const;
          } catch {
            return "failed" as const;
          }
        }
        // No SDK here (Expo Go, web) or it failed: the browser sign-in.
      }
      const { verifier, challenge } = await pkce();
      const redirect = Linking.createURL("auth");
      const url = `${API_URL}/api/mobile/v1/auth/oauth/start?${new URLSearchParams(
        { provider, challenge, redirect, locale: guestLocale },
      ).toString()}`;
      // Web: a full-page redirect, not a popup — Safari blocks popups that
      // aren't opened right in the tap handler (we await PKCE first). The
      // verifier waits in this tab's sessionStorage for /auth (app/auth.tsx).
      if (Platform.OS === "web") {
        globalThis.sessionStorage?.setItem(WEB_VERIFIER_KEY, verifier);
        globalThis.location?.assign(url);
        return "cancelled" as const;
      }
      const res = await WebBrowser.openAuthSessionAsync(url, redirect, {
        preferEphemeralSession: true,
      });
      if (res.type !== "success") return "cancelled" as const;
      const { queryParams } = Linking.parse(res.url);
      const code = queryParams?.code;
      if (typeof code !== "string") return "failed" as const;
      try {
        const result = await api<SessionResult>("/auth/oauth/exchange", {
          body: { code, verifier, device: device() },
        });
        await finishSignIn(result);
        return "ok" as const;
      } catch {
        return "failed" as const;
      }
    },
    [finishSignIn, guestLocale],
  );

  const completeWebSignIn = useCallback(
    async (code: string) => {
      const verifier = globalThis.sessionStorage?.getItem(WEB_VERIFIER_KEY);
      globalThis.sessionStorage?.removeItem(WEB_VERIFIER_KEY);
      if (!verifier) return "failed" as const;
      try {
        const result = await api<SessionResult>("/auth/oauth/exchange", {
          body: { code, verifier, device: device() },
        });
        await finishSignIn(result);
        return "ok" as const;
      } catch {
        return "failed" as const;
      }
    },
    [finishSignIn],
  );

  const signOut = useCallback(async () => {
    await api("/auth/signout", { method: "POST" }).catch(() => {});
    await forget();
  }, [forget]);

  const refreshMe = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ME_KEY });
  }, [queryClient]);

  const value = useMemo<Ctx>(
    () => ({
      status,
      me,
      token: token ?? null,
      locale,
      setGuestLocale,
      finishSignIn,
      signInWithProvider,
      completeWebSignIn,
      signOut,
      refreshMe,
    }),
    [
      status,
      me,
      token,
      locale,
      finishSignIn,
      signInWithProvider,
      completeWebSignIn,
      signOut,
      refreshMe,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

/** The signed-in member (only inside signed-in screens). */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error("useMe while signed out");
  return me;
}

/** Device description sent with sign-ins. */
export { device as signInDevice };
