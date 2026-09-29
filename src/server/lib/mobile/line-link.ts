import type { LineLinkOutcome } from "@contract/line";
import { Prisma } from "@/server/generated/prisma/client";
import { AccountState } from "@/server/generated/prisma/enums";
import { resolveUserId } from "@/server/lib/auth/adapter";
import { db } from "@/server/lib/db";
import { fetchLineFriendship } from "@/server/lib/line";
import { safeReturnPath, signLinkState } from "@/server/lib/line-link";
import { syncLineMenuFor } from "@/server/lib/line-menu-sync";
import type { LineIdentity } from "@/server/lib/mobile/oauth";
import { notifySignInMethodAdded } from "@/server/lib/security-notice";

/**
 * Linking LINE to a signed-in member from the app (設定 → LINE, the Home
 * banner, onboarding) — the website's /api/line/link/{start,callback}:
 *
 * 1. POST /line/link (bearer): a start URL carrying the website's signed
 *    link state (src/server/lib/line-link.ts: member, return path, 10
 *    minutes) and where to come back to.
 * 2. GET /line/link/start (in the browser): remembers the flow in the
 *    sign-in flow cookie, marked as a link (src/server/lib/mobile/oauth.ts),
 *    and goes to LINE — with the same LINE callback as sign-in, so the LINE
 *    channel needs no new callback URL.
 * 3. /auth/oauth/callback/line: for a link flow, linkLine() below (the
 *    website's callback rules), then back to the app with ?line=<outcome>.
 */

/** Where the native app receives the result (openAuthSessionAsync). */
export const APP_LINK_REDIRECT = "aisalumni://line-link";

/**
 * Where the result may be sent: the app's scheme (native), Expo Go for
 * local development servers only, or a path of the web app on this origin.
 */
export function linkRedirect(
  value: unknown,
  returnTo: string,
  origin: string,
): string {
  if (value === APP_LINK_REDIRECT) return value;
  if (
    typeof value === "string" &&
    value.length <= 300 &&
    process.env.NODE_ENV !== "production" &&
    /^exps?:\/\/[\w.:-]+\/--\/line-link$/.test(value)
  )
    return value;
  return `${origin}${safeReturnPath(returnTo)}`;
}

/** The URL the app opens in a browser to link LINE (valid 10 minutes). */
export function lineLinkStartUrl(input: {
  userId: string;
  locale: "ja" | "en";
  origin: string;
  /** the web app's path to come back to, e.g. "/settings" */
  returnTo: string;
  /** native: APP_LINK_REDIRECT (or Expo Go's); web: omitted */
  redirect?: string;
}): string {
  const s = signLinkState({
    userId: input.userId,
    returnTo: input.returnTo,
    locale: input.locale,
  });
  const q = new URLSearchParams({ s });
  if (input.redirect) q.set("redirect", input.redirect);
  return `${input.origin}/api/mobile/v1/line/link/start?${q.toString()}`;
}

/** `to` with ?line=<outcome> added (keeping its own query). */
export function withOutcome(to: string, outcome: LineLinkOutcome): string {
  const [base, query = ""] = to.split("?");
  const q = new URLSearchParams(query);
  q.set("line", outcome);
  return `${base}?${q.toString()}`;
}

/**
 * Link the LINE account to the member, as the website's
 * /api/line/link/callback does: never a LINE account that is another
 * member's, one LINE account per member (a previous one is replaced),
 * friendship with the Official Account recorded, a security notice, and the
 * LINE menu brought up to date.
 */
export async function linkLine(
  memberId: string,
  identity: LineIdentity,
): Promise<LineLinkOutcome> {
  const userId = await resolveUserId(memberId);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.state === AccountState.DEACTIVATED) return "error";

  const [otherAccount, otherUser] = await Promise.all([
    db.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "line",
          providerAccountId: identity.sub,
        },
      },
      select: { userId: true },
    }),
    db.user.findUnique({
      where: { lineUserId: identity.sub },
      select: { id: true },
    }),
  ]);
  if (
    (otherAccount && otherAccount.userId !== user.id) ||
    (otherUser && otherUser.id !== user.id)
  )
    return "taken";

  const following = await fetchLineFriendship(identity.accessToken);

  try {
    await db.$transaction([
      db.account.deleteMany({
        where: {
          userId: user.id,
          provider: "line",
          providerAccountId: { not: identity.sub },
        },
      }),
      db.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: "line",
            providerAccountId: identity.sub,
          },
        },
        create: {
          userId: user.id,
          type: "oidc",
          provider: "line",
          providerAccountId: identity.sub,
          access_token: identity.accessToken,
          id_token: identity.idToken,
          token_type: "Bearer",
          scope: "profile openid",
        },
        update: {
          access_token: identity.accessToken,
          id_token: identity.idToken,
        },
      }),
      db.user.update({
        where: { id: user.id },
        data: {
          lineUserId: identity.sub,
          lineDisplayName: identity.name,
          // null = unknown (API error): keep the webhook-maintained value.
          ...(following === null ? {} : { lineFollowing: following }),
        },
      }),
    ]);
  } catch (e) {
    // Lost a race with another member linking the same LINE account.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return "taken";
    console.error("[line-link] failed to save link", e);
    return "error";
  }

  await notifySignInMethodAdded(user.id, "line");
  await syncLineMenuFor({ id: user.id });
  return "linked";
}
