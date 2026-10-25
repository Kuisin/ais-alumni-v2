import { createHash } from "node:crypto";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import { AccountState, Locale } from "@/server/generated/prisma/enums";
import { resolveUserId } from "@/server/lib/auth/adapter";
import { normalizeEmail } from "@/server/lib/auth/otp";
import { db } from "@/server/lib/db";
import { nameColumns } from "@/server/lib/names";

/**
 * Sign in with Apple in the iOS app (App Store guideline 4.8: an app with
 * LINE sign-in must also offer it). The app gets an identity token from
 * iOS (expo-apple-authentication) and sends it with the nonce it asked
 * for; we check Apple signed it for our app, then find or create the
 * member as email sign-in does — Apple has already confirmed the address,
 * so it isn't asked for again. Nor is the name (App Store guideline 4:
 * nothing Sign in with Apple gave may be asked for again): iOS gives it to
 * the app on the first sign-in only, and it fills in the member's name, so
 * the application starts with it.
 *
 * Addresses can be Apple's private relay (…@privaterelay.appleid.com):
 * mail to them is forwarded only from senders registered in the Apple
 * Developer account (Sign in with Apple → email communication: the
 * EMAIL_FROM domain).
 *
 * Deleting the account revokes the member's Apple tokens (guideline
 * 5.1.1(v)) — which needs a Sign in with Apple key from the Apple Developer
 * account: APPLE_TEAM_ID, APPLE_SIGN_IN_KEY_ID, APPLE_SIGN_IN_PRIVATE_KEY
 * (the .p8's contents). With it, sign-in exchanges the app's authorization
 * code for a refresh token (kept on the Account) that deletion revokes;
 * without it both are skipped.
 */

const ISSUER = "https://appleid.apple.com";
/** The app's bundle id: the client its codes and tokens belong to. */
const CLIENT_ID = "net.kailab.aisalumni";
const KEYS = createRemoteJWKSet(new URL(`${ISSUER}/auth/keys`));

/**
 * Who the token must be issued to: the app's bundle id. Expo Go's too on
 * servers that aren't production (developing the sign-in there).
 */
function audiences(): string[] {
  const ids = [CLIENT_ID];
  if (process.env.VERCEL_ENV !== "production") ids.push("host.exp.Exponent");
  return ids;
}

export type AppleIdentity = {
  /** Apple's stable user id (for this team) */
  sub: string;
  /** confirmed by Apple; null when the token has none */
  email: string | null;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** The identity in a token Apple signed for this app; null = not valid. */
export async function appleIdentity(
  identityToken: string,
  nonce: string,
): Promise<AppleIdentity | null> {
  try {
    const { payload } = await jwtVerify(identityToken, KEYS, {
      issuer: ISSUER,
      audience: audiences(),
    });
    // The nonce the app asked with (as is, or SHA-256 hashed): the token
    // was made for this sign-in, not replayed from another.
    if (payload.nonce !== nonce && payload.nonce !== sha256(nonce)) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    const verified =
      payload.email_verified === true || payload.email_verified === "true";
    const email =
      typeof payload.email === "string" && verified
        ? normalizeEmail(payload.email)
        : null;
    return { sub: payload.sub, email };
  } catch {
    return null;
  }
}

/** The name iOS gave the app (first sign-in only); parts may be missing. */
export type AppleName = {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
};

/** Han or kana: the name is the kanji name (姓 名), else the romaji one. */
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** User columns for Apple's name; null when it has no family and given name. */
export function appleNameColumns(name: AppleName | null | undefined) {
  const given = name?.givenName?.trim().slice(0, 50) || null;
  const family = name?.familyName?.trim().slice(0, 50) || null;
  const middle = name?.middleName?.trim().slice(0, 50) || null;
  if (!given && !family) return null;
  return JAPANESE.test(`${family ?? ""}${given ?? ""}`)
    ? nameColumns({
        lastNameRomaji: null,
        firstNameRomaji: null,
        middleNameRomaji: null,
        lastNameKanji: family,
        firstNameKanji: given,
      })
    : nameColumns({
        lastNameRomaji: family,
        firstNameRomaji: given,
        middleNameRomaji: middle,
        lastNameKanji: null,
        firstNameKanji: null,
      });
}

/**
 * Fill in what Apple gave that a member not yet approved lacks: the name,
 * and — for an account made without an address — Apple's confirmed one
 * (when no other account has it), so the email step is skipped.
 */
async function completeFromApple(
  userId: string,
  id: AppleIdentity,
  name: AppleName | null,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      state: true,
      primaryEmail: true,
      nameRomaji: true,
      nameKanji: true,
    },
  });
  if (!user || user.state === AccountState.ACTIVE) return;
  const names =
    user.nameRomaji || user.nameKanji ? null : appleNameColumns(name);
  const email =
    id.email &&
    !user.primaryEmail &&
    user.state === AccountState.UNVERIFIED_EMAIL &&
    !(await db.user.findUnique({
      where: { primaryEmail: id.email },
      select: { id: true },
    }))
      ? {
          primaryEmail: id.email,
          emailVerifiedAt: new Date(),
          state: AccountState.EMAIL_VERIFIED,
        }
      : null;
  if (!names && !email) return;
  await db.user.update({
    where: { id: userId },
    data: { ...names, ...email },
  });
}

/**
 * The member signing in with this Apple ID: linked before; else the member
 * with Apple's confirmed address (now linked); else a new account with that
 * address confirmed (as email sign-in creates one), or — without one — a
 * new account that confirms an address in onboarding, like LINE's. Apple's
 * name and address fill in what a member not yet approved lacks.
 */
export async function memberForApple(
  id: AppleIdentity,
  locale: "ja" | "en",
  name: AppleName | null = null,
): Promise<string> {
  const account = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "apple",
        providerAccountId: id.sub,
      },
    },
    select: { userId: true },
  });
  if (account) {
    const userId = await resolveUserId(account.userId);
    await completeFromApple(userId, id, name);
    return userId;
  }

  const existing = id.email
    ? await db.user.findUnique({
        where: { primaryEmail: id.email },
        select: { id: true },
      })
    : null;
  const userId =
    existing?.id ??
    (
      await db.user.create({
        data: id.email
          ? {
              primaryEmail: id.email,
              emailVerifiedAt: new Date(),
              state: AccountState.EMAIL_VERIFIED,
              locale: locale === "en" ? Locale.en : Locale.ja,
            }
          : {
              primaryEmail: null,
              emailVerifiedAt: null,
              state: AccountState.UNVERIFIED_EMAIL,
              locale: locale === "en" ? Locale.en : Locale.ja,
            },
        select: { id: true },
      })
    ).id;
  await db.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "apple",
        providerAccountId: id.sub,
      },
    },
    create: {
      userId,
      type: "oidc",
      provider: "apple",
      providerAccountId: id.sub,
      scope: "name email",
    },
    update: {},
  });
  await completeFromApple(userId, id, name);
  return userId;
}

// ---- tokens: keep (sign-in) and revoke (account deletion) ----

type Key = { teamId: string; keyId: string; privateKey: string };

function key(): Key | null {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_SIGN_IN_KEY_ID?.trim();
  const privateKey = process.env.APPLE_SIGN_IN_PRIVATE_KEY?.trim().replace(
    /\\n/g,
    "\n",
  );
  return teamId && keyId && privateKey ? { teamId, keyId, privateKey } : null;
}

/** The client secret Apple's token endpoints take: a short-lived JWT. */
async function clientSecret(k: Key): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: k.keyId })
    .setIssuer(k.teamId)
    .setSubject(CLIENT_ID)
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(await importPKCS8(k.privateKey, "ES256"));
}

async function post(path: string, form: Record<string, string>) {
  return fetch(`${ISSUER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10_000),
  });
}

/**
 * Sign-in: trade the app's one-time authorization code for a refresh token
 * and keep it on the member's Apple account (for revoking it later). Never
 * throws: a failure only means there's nothing to revoke.
 */
export async function keepAppleToken(
  sub: string,
  authorizationCode: string,
): Promise<void> {
  const k = key();
  if (!k) return;
  try {
    const res = await post("/auth/token", {
      client_id: CLIENT_ID,
      client_secret: await clientSecret(k),
      code: authorizationCode,
      grant_type: "authorization_code",
    });
    const json = (await res.json().catch(() => null)) as {
      refresh_token?: string;
    } | null;
    if (!res.ok || !json?.refresh_token) {
      console.error(`[apple] token exchange failed: ${res.status}`);
      return;
    }
    await db.account.update({
      where: {
        provider_providerAccountId: {
          provider: "apple",
          providerAccountId: sub,
        },
      },
      data: { refresh_token: json.refresh_token },
    });
  } catch (e) {
    console.error("[apple] token exchange failed", e);
  }
}

/**
 * Account deletion: tell Apple to revoke the member's tokens, which also
 * removes the app from their Apple ID's list. Best effort — deletion goes
 * on regardless.
 */
export async function revokeAppleTokens(userId: string): Promise<void> {
  const k = key();
  if (!k) return;
  const accounts = await db.account.findMany({
    where: { userId, provider: "apple", refresh_token: { not: null } },
    select: { refresh_token: true },
  });
  for (const a of accounts) {
    try {
      const res = await post("/auth/revoke", {
        client_id: CLIENT_ID,
        client_secret: await clientSecret(k),
        token: a.refresh_token ?? "",
        token_type_hint: "refresh_token",
      });
      if (!res.ok) console.error(`[apple] revoke failed: ${res.status}`);
    } catch (e) {
      console.error("[apple] revoke failed", e);
    }
  }
}
