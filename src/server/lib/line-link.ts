import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appUrl } from "@/server/lib/urls";

/**
 * Signed state for the custom LINE linking flow (§5.2).
 *
 * Linking is independent of Auth.js so that it can be completed on a phone
 * that scanned a QR code shown on a desktop browser: the phone has no session,
 * so the state itself carries (and authenticates) the account to link.
 *
 * Security tradeoff: anyone holding a valid state token can bind *their* LINE
 * account to the user in the token for up to LINK_STATE_TTL_MS. The token is
 * only ever shown to the signed-in user (button / QR on their own screen), is
 * HMAC-signed with AUTH_SECRET, and expires after 10 minutes. The callback also
 * refuses a LINE account that already belongs to someone else.
 */

export const LINK_STATE_TTL_MS = 10 * 60 * 1000;

export type LinkLocale = "ja" | "en";

export type LinkState = {
  /** user id to link */
  u: string;
  /** locale-relative return path, e.g. "/app/settings" */
  r: string;
  /** UI locale */
  l: LinkLocale;
  /** expiry (ms since epoch) */
  e: number;
  /** random nonce: makes every token unique (and doubles as OAuth `state` entropy) */
  n: string;
};

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function mac(payload: string, key: string): Buffer {
  return createHmac("sha256", key).update(`line-link:${payload}`).digest();
}

/**
 * Only allow same-site, locale-relative paths ("/app/settings", "/app/onboarding/line?x=1").
 * Anything else (absolute URLs, protocol-relative "//evil", backslashes) falls
 * back to "/" to prevent open redirects.
 */
export function safeReturnPath(path: unknown): string {
  if (typeof path !== "string") return "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    return "/";
  if (path.length > 512) return "/";
  return path;
}

export function signLinkState(
  input: { userId: string; returnTo: string; locale: LinkLocale },
  opts: { now?: number; key?: string } = {},
): string {
  const state: LinkState = {
    u: input.userId,
    r: safeReturnPath(input.returnTo),
    l: input.locale,
    e: (opts.now ?? Date.now()) + LINK_STATE_TTL_MS,
    n: randomBytes(12).toString("base64url"),
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${mac(payload, opts.key ?? secret()).toString("base64url")}`;
}

/** Returns the state if the signature is valid and it has not expired, else null. */
export function verifyLinkState(
  token: unknown,
  opts: { now?: number; key?: string } = {},
): LinkState | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = mac(payload, opts.key ?? secret());
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;

  let state: LinkState;
  try {
    state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof state?.u !== "string" ||
    typeof state.r !== "string" ||
    (state.l !== "ja" && state.l !== "en") ||
    typeof state.e !== "number" ||
    typeof state.n !== "string"
  ) {
    return null;
  }
  if (state.e <= (opts.now ?? Date.now())) return null;
  return { ...state, r: safeReturnPath(state.r) };
}

/** Absolute URL that starts linking LINE to `userId` (works from any device). */
export function lineLinkStartUrl(
  userId: string,
  returnTo: string,
  locale: LinkLocale,
): string {
  const s = signLinkState({ userId, returnTo, locale });
  return `${appUrl()}/api/line/link/start?s=${encodeURIComponent(s)}`;
}

export function lineLinkCallbackUrl(): string {
  return `${appUrl()}/api/line/link/callback`;
}

/** "Add friend" URL for the Official Account, or null if not configured. */
export function lineAddFriendUrl(): string | null {
  const id = process.env.NEXT_PUBLIC_LINE_OA_ID;
  return id ? `https://line.me/R/ti/p/${encodeURIComponent(id)}` : null;
}

/** Locale-prefixed absolute URL for a return path, with extra query params. */
export function returnUrl(
  state: Pick<LinkState, "r" | "l">,
  params: Record<string, string>,
): string {
  const url = new URL(
    `${appUrl()}/${state.l}${state.r === "/" ? "" : state.r}`,
  );
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Result of the linking flow, passed back as `?line=<outcome>` or `?status=<outcome>`. */
export type LinkOutcome =
  | "linked"
  | "taken"
  | "cancelled"
  | "error"
  | "expired";

export const LINK_OUTCOMES: readonly LinkOutcome[] = [
  "linked",
  "taken",
  "cancelled",
  "error",
  "expired",
];

export function parseLinkOutcome(value: unknown): LinkOutcome | null {
  return LINK_OUTCOMES.includes(value as LinkOutcome)
    ? (value as LinkOutcome)
    : null;
}
