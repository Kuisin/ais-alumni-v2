import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@/server/generated/prisma/client";
import { resolveUserId } from "@/server/lib/auth/adapter";
import { db } from "@/server/lib/db";

/**
 * Native app sessions (mobile/). The app signs in once (email code, or
 * Google / LINE through the system browser) and receives a random bearer
 * token, kept in the device keychain and sent as `Authorization: Bearer …`.
 * Only its SHA-256 is stored (MobileSession.tokenHash). Sessions last 180
 * days from the last use; signing out on the device deletes the row.
 *
 * The mobile API (/api/mobile/v1) accepts ONLY this header — never the
 * website's cookie — so no web page can make a member's browser call it
 * (mobileRoute in src/lib/mobile/http.ts). Browsers never send the header
 * on their own.
 */

export const MOBILE_SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
/** lastUsedAt / expiresAt are refreshed at most this often. */
const TOUCH_EVERY_MS = 24 * 60 * 60 * 1000;
const PREFIX = "aism_";

export function hashMobileToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

/** The token from an `Authorization: Bearer <token>` header, if well-formed. */
export function bearerToken(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  const token = m?.[1];
  if (!token?.startsWith(PREFIX) || token.length > 100) return null;
  return token;
}

export type DeviceInfo = {
  platform?: string | null;
  deviceName?: string | null;
};

function clean(value: string | null | undefined, max: number): string | null {
  const v = value?.trim();
  return v ? v.slice(0, max) : null;
}

/** A Google / LINE sign-in code that was already exchanged once. */
export class HandoffReplayError extends Error {}

/**
 * Start a session for a signed-in member; returns the bearer token.
 * `handoffJti`: the Google / LINE sign-in code it came from — each code
 * starts at most one session (unique column); a second use throws
 * HandoffReplayError and ends the session the code already started.
 */
export async function createMobileSession(
  userId: string,
  device: DeviceInfo = {},
  handoffJti?: string,
): Promise<string> {
  const token = PREFIX + randomBytes(32).toString("base64url");
  const now = Date.now();
  try {
    await db.mobileSession.create({
      data: {
        userId,
        tokenHash: hashMobileToken(token),
        platform: clean(device.platform, 20),
        deviceName: clean(device.deviceName, 100),
        handoffJti: handoffJti ?? null,
        lastUsedAt: new Date(now),
        expiresAt: new Date(now + MOBILE_SESSION_TTL_MS),
      },
    });
  } catch (e) {
    if (
      handoffJti &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      // Replayed code: whoever exchanged it first may not be the app.
      await db.mobileSession.deleteMany({ where: { handoffJti } });
      throw new HandoffReplayError();
    }
    throw e;
  }
  return token;
}

/**
 * The session a token belongs to — its id and member (following account
 * merges) — or null when the token is unknown or expired. Refreshes the
 * expiry about once a day.
 */
export async function mobileSessionFor(
  token: string,
): Promise<{ id: string; userId: string } | null> {
  const row = await db.mobileSession.findUnique({
    where: { tokenHash: hashMobileToken(token) },
    select: { id: true, userId: true, lastUsedAt: true, expiresAt: true },
  });
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await db.mobileSession.deleteMany({ where: { id: row.id } });
    return null;
  }
  if (now - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    await db.mobileSession.updateMany({
      where: { id: row.id },
      data: {
        lastUsedAt: new Date(now),
        expiresAt: new Date(now + MOBILE_SESSION_TTL_MS),
      },
    });
  }
  return { id: row.id, userId: await resolveUserId(row.userId) };
}

/** The member a token belongs to, or null (see mobileSessionFor). */
export async function mobileSessionUserId(
  token: string,
): Promise<string | null> {
  return (await mobileSessionFor(token))?.userId ?? null;
}

/**
 * Is this device session still signed in? Website sessions made for the
 * app's web view carry its id and end with it (the jwt callback in
 * src/auth.ts), e.g. when the device is signed out.
 */
export async function mobileSessionActive(id: string): Promise<boolean> {
  const row = await db.mobileSession.findUnique({
    where: { id },
    select: { expiresAt: true },
  });
  return Boolean(row && row.expiresAt.getTime() > Date.now());
}

/** Sign out this device. */
export async function revokeMobileSession(token: string): Promise<void> {
  await db.mobileSession.deleteMany({
    where: { tokenHash: hashMobileToken(token) },
  });
}

/** The device session making this request (its bearer token), or null. */
export async function sessionFromRequest(
  request: Request,
): Promise<{ id: string; userId: string } | null> {
  const token = bearerToken(request.headers.get("authorization"));
  return token ? mobileSessionFor(token) : null;
}
