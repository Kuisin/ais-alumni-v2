import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AccountState, Locale } from "@/server/generated/prisma/enums";
import { resolveUserId } from "@/server/lib/auth/adapter";
import { db } from "@/server/lib/db";
import { fetchLineFriendship } from "@/server/lib/line";

/**
 * LINE Login for the app (native and web), without Auth.js:
 *
 * 1. The app opens GET /auth/oauth/start?provider=line&challenge&redirect
 *    in a browser with a PKCE challenge. We remember the sign-in in a signed,
 *    short-lived cookie (FLOW_COOKIE) and send the browser to LINE.
 * 2. LINE returns to /auth/oauth/callback/line. We check the state against
 *    that cookie, trade LINE's code for tokens, verify the ID token, and find
 *    or create the member as the website's Auth.js setup does (an existing
 *    LINE account link, else a new account without email — LINE emails are
 *    never trusted; the member confirms one by code afterwards).
 * 3. We redirect to the app's `redirect` with a short-lived code bound to
 *    the challenge; only the app, which holds the verifier, can trade it at
 *    POST /auth/oauth/exchange for a session (RFC 7636 / RFC 8252). Each
 *    code starts one session at most (MobileSession.handoffJti).
 *
 * LINE channel settings: the callback URL is
 * https://<this site>/api/mobile/v1/auth/oauth/callback/line; env
 * AUTH_LINE_ID / AUTH_LINE_SECRET (the channel), AUTH_SECRET (signing).
 */

/** Where the native app receives the sign-in code. */
export const APP_REDIRECT = "aisalumni://auth";
export const FLOW_COOKIE = "ais_oauth_flow";
export const FLOW_COOKIE_PATH = "/api/mobile/v1/auth/oauth";
const FLOW_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 2 * 60 * 1000;

const LINE_AUTHORIZE = "https://access.line.me/oauth2/v2.1/authorize";
const LINE_TOKEN = "https://api.line.me/oauth2/v2.1/token";
const LINE_VERIFY = "https://api.line.me/oauth2/v2.1/verify";

export function lineReady(): boolean {
  return Boolean(
    process.env.AUTH_LINE_ID?.trim() && process.env.AUTH_LINE_SECRET?.trim(),
  );
}

/**
 * Where a code may be sent: the app's own scheme, this site's /auth page
 * (the web app), or Expo Go for local development servers only.
 */
export function allowedRedirect(value: unknown, origin: string): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  if (value === APP_REDIRECT || value === `${origin}/auth`) return value;
  if (
    process.env.NODE_ENV !== "production" &&
    /^exps?:\/\/[\w.:-]+\/--\/auth$/.test(value)
  )
    return value;
  return null;
}

/** PKCE (S256): 43–128 unreserved characters. */
export function validVerifier(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9\-._~]{43,128}$/.test(v);
}

export function validChallenge(c: unknown): c is string {
  return typeof c === "string" && /^[A-Za-z0-9_-]{43}$/.test(c);
}

export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function key(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  // A separate key per purpose: values can't be swapped between them. The
  // handoff key matches the website's, so codes work on either backend.
  return createHmac("sha256", secret).update(purpose).digest();
}

function sign(payload: unknown, purpose: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", key(purpose))
    .update(body)
    .digest("base64url");
  return `${body}.${mac}`;
}

function unsign<T>(value: unknown, purpose: string): T | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(
    createHmac("sha256", key(purpose)).update(body).digest("base64url"),
  );
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

// ---- the one-time code for the app ----

/** u: member, c: PKCE challenge, e: expiry (ms), j: one-time id */
type CodePayload = { u: string; c: string; e: number; j: string };

export function createHandoffCode(
  userId: string,
  challenge: string,
  now = Date.now(),
): string {
  return sign(
    {
      u: userId,
      c: challenge,
      e: now + CODE_TTL_MS,
      j: randomBytes(16).toString("base64url"),
    } satisfies CodePayload,
    "mobile-handoff",
  );
}

/**
 * The member and the code's one-time id, if the code is genuine, unexpired
 * and matches the verifier. The caller must refuse a second use of `jti`
 * (createMobileSession does).
 */
export function redeemHandoffCode(
  code: unknown,
  verifier: unknown,
  now = Date.now(),
): { userId: string; jti: string } | null {
  if (!validVerifier(verifier)) return null;
  const p = unsign<CodePayload>(code, "mobile-handoff");
  if (
    !p ||
    typeof p.u !== "string" ||
    typeof p.e !== "number" ||
    typeof p.j !== "string" ||
    p.e < now
  )
    return null;
  const a = Buffer.from(challengeFor(verifier));
  const b = Buffer.from(String(p.c));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId: p.u, jti: p.j };
}

// ---- the sign-in in progress (cookie) ----

type Flow = {
  state: string;
  nonce: string;
  challenge: string;
  redirect: string;
  locale: "ja" | "en";
  e: number;
  /**
   * Linking LINE to this member (src/server/lib/mobile/line-link.ts)
   * instead of signing in; `challenge` is then unused.
   */
  link?: string;
};

export function newFlow(
  challenge: string,
  redirect: string,
  locale: "ja" | "en",
  link?: string,
): { flow: Flow; cookie: string } {
  const flow: Flow = {
    state: randomBytes(16).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    challenge,
    redirect,
    locale,
    e: Date.now() + FLOW_TTL_MS,
    ...(link ? { link } : {}),
  };
  return { flow, cookie: sign(flow, "oauth-flow") };
}

export type { Flow as OAuthFlow };

export function readFlow(cookie: unknown, state: unknown): Flow | null {
  const flow = unsign<Flow>(cookie, "oauth-flow");
  if (!flow || typeof state !== "string" || flow.e < Date.now()) return null;
  const a = Buffer.from(flow.state);
  const b = Buffer.from(state);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return flow;
}

export function flowCookieHeader(value: string, secure: boolean): string {
  const maxAge = value ? Math.floor(FLOW_TTL_MS / 1000) : 0;
  return [
    `${FLOW_COOKIE}=${value}`,
    `Path=${FLOW_COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name)
      return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// ---- LINE ----

export function lineCallbackUrl(origin: string): string {
  return `${origin}${FLOW_COOKIE_PATH}/callback/line`;
}

export function lineAuthorizeUrl(flow: Flow, origin: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.AUTH_LINE_ID ?? "",
    redirect_uri: lineCallbackUrl(origin),
    state: flow.state,
    nonce: flow.nonce,
    scope: "profile openid",
    // Show "Add friend" for the Official Account on the consent screen.
    bot_prompt: "aggressive",
    ui_locales: flow.locale,
  });
  return `${LINE_AUTHORIZE}?${q.toString()}`;
}

export type LineIdentity = {
  sub: string;
  name: string | null;
  picture: string | null;
  accessToken: string;
  idToken: string;
};

/** Trade LINE's code for tokens and verify the ID token. */
export async function lineIdentity(
  code: string,
  flow: Flow,
  origin: string,
): Promise<LineIdentity | null> {
  const clientId = process.env.AUTH_LINE_ID ?? "";
  const res = await fetch(LINE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: lineCallbackUrl(origin),
      client_id: clientId,
      client_secret: process.env.AUTH_LINE_SECRET ?? "",
    }),
  });
  if (!res.ok) return null;
  const tokens = (await res.json()) as {
    access_token?: string;
    id_token?: string;
  };
  if (!tokens.id_token || !tokens.access_token) return null;
  const verified = await fetch(LINE_VERIFY, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: tokens.id_token,
      client_id: clientId,
      nonce: flow.nonce,
    }),
  });
  if (!verified.ok) return null;
  const claims = (await verified.json()) as {
    sub?: string;
    name?: string;
    picture?: string;
  };
  if (!claims.sub) return null;
  return {
    sub: claims.sub,
    name: claims.name ?? null,
    picture: claims.picture ?? null,
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
  };
}

const LINE_PROFILE = "https://api.line.me/v2/profile";

/**
 * The LINE account behind an access token that the app's LINE SDK got
 * (native sign-in: the LINE app, or LINE's own login screen when it isn't
 * installed). The token must have been issued to our channel — a token for
 * any other LINE app is refused — and still be valid; the profile it opens
 * says who it is. LINE's recommended check for a native app's backend.
 */
export async function lineIdentityFromAccessToken(
  accessToken: string,
): Promise<LineIdentity | null> {
  const clientId = process.env.AUTH_LINE_ID?.trim();
  if (!clientId) return null;
  const verify = await fetch(
    `${LINE_VERIFY}?${new URLSearchParams({ access_token: accessToken })}`,
  );
  if (!verify.ok) return null;
  const token = (await verify.json()) as {
    client_id?: string;
    expires_in?: number;
    scope?: string;
  };
  if (
    token.client_id !== clientId ||
    !(Number(token.expires_in) > 0) ||
    !token.scope?.split(" ").includes("profile")
  )
    return null;
  const res = await fetch(LINE_PROFILE, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const profile = (await res.json()) as {
    userId?: string;
    displayName?: string;
    pictureUrl?: string;
  };
  if (!profile.userId) return null;
  return {
    sub: profile.userId,
    name: profile.displayName ?? null,
    picture: profile.pictureUrl ?? null,
    accessToken,
    idToken: "",
  };
}

/**
 * The member signing in with this LINE account — linked before, or a new
 * account without email (as the website's Auth.js adapter creates it) —
 * with their LINE name and Official Account friendship brought up to date.
 */
export async function memberForLine(
  id: LineIdentity,
  locale: "ja" | "en",
): Promise<string> {
  const account = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "line",
        providerAccountId: id.sub,
      },
    },
    select: { userId: true },
  });
  let userId: string;
  if (account) userId = await resolveUserId(account.userId);
  else {
    const user = await db.user.create({
      data: {
        primaryEmail: null,
        emailVerifiedAt: null,
        state: AccountState.UNVERIFIED_EMAIL,
        locale: locale === "en" ? Locale.en : Locale.ja,
        avatarUrl: id.picture,
      },
      select: { id: true },
    });
    await db.account.create({
      data: {
        userId: user.id,
        type: "oidc",
        provider: "line",
        providerAccountId: id.sub,
        access_token: id.accessToken,
        token_type: "Bearer",
        scope: "profile openid",
      },
    });
    userId = user.id;
  }
  const following = await fetchLineFriendship(id.accessToken);
  await db.user.update({
    where: { id: userId },
    data: {
      lineUserId: id.sub,
      ...(id.name ? { lineDisplayName: id.name } : {}),
      ...(following === null ? {} : { lineFollowing: following }),
    },
  });
  return userId;
}
