import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

/**
 * LINE sign-in with LINE's own SDK (@xmartlabs/react-native-line): opens the
 * LINE app when it's installed — the member just confirms there — and
 * LINE's login screen otherwise, then returns straight to the app. The
 * access token it gives goes to POST /auth/line/native.
 *
 * Only in development / store builds: Expo Go and the web don't have the
 * native module, and use the browser sign-in instead (src/lib/auth.tsx).
 * The LINE Login channel needs this app registered ("Mobile app": iOS
 * bundle ID and Android package + signature) — see AGENTS.md.
 */

type LineModule = typeof import("@xmartlabs/react-native-line");

export type LineSdkResult =
  | { type: "ok"; accessToken: string }
  | { type: "cancelled" }
  /** no SDK in this build, or it failed: use the browser sign-in */
  | { type: "unavailable" };

let loaded: LineModule | null | undefined;
let setUpFor: string | null = null;

function sdk(): LineModule | null {
  if (loaded !== undefined) return loaded;
  loaded = null;
  if (Platform.OS === "web" || isRunningInExpoGo()) return loaded;
  try {
    // Throws when the native module isn't in this build.
    loaded = require("@xmartlabs/react-native-line") as LineModule;
  } catch {
    loaded = null;
  }
  return loaded;
}

function cancelled(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown };
  return (
    err?.code === "LOGIN_CANCELLED" ||
    /cancel/i.test(String(err?.message ?? ""))
  );
}

export async function lineSdkSignIn(channelId: string): Promise<LineSdkResult> {
  const mod = sdk();
  if (!mod) return { type: "unavailable" };
  const Line = mod.default;
  try {
    if (setUpFor !== channelId) {
      await Line.setup({ channelId });
      setUpFor = channelId;
    }
    const result = await Line.login({
      scopes: [mod.Scope.Profile, mod.Scope.OpenId],
      // Offer the Official Account (notifications on LINE), as the browser
      // sign-in does.
      botPrompt: mod.BotPrompt.Aggressive,
    });
    return { type: "ok", accessToken: result.accessToken.accessToken };
  } catch (e) {
    if (cancelled(e)) return { type: "cancelled" };
    console.warn("[line] SDK sign-in failed", e);
    return { type: "unavailable" };
  }
}
