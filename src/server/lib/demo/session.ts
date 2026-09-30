import { db } from "@/server/lib/db";
import { bearerToken, mobileSessionUserId } from "@/server/lib/mobile/tokens";

/**
 * The App Review demo account (REVIEW_EMAIL, src/server/lib/auth/
 * review-account.ts) never sees real data: every API request it makes is
 * answered from src/server/lib/demo/fixtures.ts instead of the handlers
 * (src/app/api/mobile/v1/[...path]+api.ts). Its account in the database is
 * never approved either, so even a request that slipped past would be
 * refused by the normal rules.
 */

let cached: { email: string; id: string | null; at: number } | null = null;
const CACHE_MS = 60_000;

/** The demo account's user id (null: demo off, or not signed up yet). */
export async function demoUserId(): Promise<string | null> {
  const email = process.env.REVIEW_EMAIL?.trim().toLowerCase();
  const code = process.env.REVIEW_CODE?.trim();
  if (!email || !code) return null;
  if (cached && cached.email === email && Date.now() - cached.at < CACHE_MS)
    return cached.id;
  const user = await db.user.findUnique({
    where: { primaryEmail: email },
    select: { id: true },
  });
  cached = { email, id: user?.id ?? null, at: Date.now() };
  return cached.id;
}

/** This bearer token belongs to the demo account. */
export async function isDemoToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  const demo = await demoUserId();
  if (!demo) return false;
  return (await mobileSessionUserId(token)) === demo;
}

export async function isDemoRequest(request: Request): Promise<boolean> {
  return isDemoToken(bearerToken(request.headers.get("authorization")));
}
