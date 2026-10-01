import { createHmac } from "node:crypto";

/**
 * Supabase Realtime (Broadcast) for live chat and in-app badges.
 *
 * Signals only: the server pushes "something changed" (ids, never message
 * text) and the browser then loads the data through the app's own
 * authorized server actions. Channels are public Broadcast channels whose
 * names are HMACs of the group / member id with AUTH_SECRET, handed only to
 * members; a leaked name reveals activity, not content. Without the env
 * vars nothing is pushed and the UI polls instead.
 *
 * Keys (Supabase's API keys): NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * (sb_publishable_…, handed to the app for listening) and
 * SUPABASE_SECRET_KEY (sb_secret_…, server only, for sending). The legacy
 * SUPABASE_SERVICE_ROLE_KEY (a JWT) still works as a fallback.
 */

export type RealtimePublic = { url: string; key: string };

export function realtimePublic(): RealtimePublic | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

/** Unguessable channel name for a chat group or a member. */
export function channelTopic(
  kind: "chat" | "user",
  id: string,
  secret = process.env.AUTH_SECRET,
): string {
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const mac = createHmac("sha256", secret)
    .update(`realtime:${kind}:${id}`)
    .digest("base64url")
    .slice(0, 32);
  return `ais:${kind}:${mac}`;
}

export type RealtimeEvent = {
  topic: string;
  event: string;
  payload: Record<string, string | number | boolean | null>;
};

/** Push signals (best-effort; never throws). */
export async function broadcast(
  events: readonly RealtimeEvent[],
): Promise<void> {
  const pub = realtimePublic();
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!pub || !key || events.length === 0) return;
  // New keys go on the apikey header only (they aren't JWTs: a Bearer
  // header with one is rejected); the legacy JWT key also as Bearer.
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
  };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  for (let i = 0; i < events.length; i += 100) {
    const chunk = events.slice(i, i + 100);
    try {
      const res = await fetch(`${pub.url}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: chunk.map((e) => ({ ...e, private: false })),
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) console.error("[realtime] broadcast failed", res.status);
    } catch (e) {
      console.error("[realtime] broadcast failed", e);
    }
  }
}

/** Ask these members' open pages to refresh (badges, lists). */
export function refreshUsers(userIds: readonly string[], reason: string) {
  return broadcast(
    userIds.map((id) => ({
      topic: channelTopic("user", id),
      event: "refresh",
      payload: { reason },
    })),
  );
}
