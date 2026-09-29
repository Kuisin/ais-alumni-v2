import { createHmac, timingSafeEqual } from "node:crypto";
import { publicUrl } from "@/server/lib/urls";

/**
 * QR tickets for event check-in. A ticket is `<userId>.<mac>`, where the MAC
 * (HMAC-SHA256 with AUTH_SECRET, truncated to 128 bits) binds the member to
 * one event, so a ticket can't be forged or reused for another event. The QR
 * holds a link to the staff check-in page, so a phone's own camera app works
 * as well as the in-app scanner.
 */

function secret(key?: string): string {
  const s = key ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function mac(eventId: string, userId: string, key?: string): Buffer {
  return createHmac("sha256", secret(key))
    .update(`event-ticket:${eventId}:${userId}`)
    .digest()
    .subarray(0, 16);
}

export function ticketToken(
  eventId: string,
  userId: string,
  key?: string,
): string {
  return `${userId}.${mac(eventId, userId, key).toString("base64url")}`;
}

/** The member id in a valid ticket for this event, else null. */
export function verifyTicket(
  eventId: string,
  token: string,
  key?: string,
): string | null {
  if (token.length > 200) return null;
  const [userId, sig, ...rest] = token.split(".");
  if (!userId || !sig || rest.length) return null;
  const given = Buffer.from(sig, "base64url");
  const expected = mac(eventId, userId, key);
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? userId : null;
}

/** Path of the staff check-in page (locale added by the middleware). */
export function checkInPath(eventId: string): string {
  return `/app/events/${eventId}/check-in`;
}

/** What the QR code encodes. */
export function ticketUrl(eventId: string, token: string): string {
  return publicUrl(`${checkInPath(eventId)}?t=${encodeURIComponent(token)}`);
}

/** Accepts a scanned link (any host/locale) or a bare token. */
export function tokenFromScan(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).searchParams.get("t");
    } catch {
      return null;
    }
  }
  return raw;
}
