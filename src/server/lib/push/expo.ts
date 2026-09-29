import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * The Expo Push Service (https://docs.expo.dev/push-notifications/
 * sending-notifications): the app's devices register Expo push tokens, and
 * we send through Expo, which delivers via APNs / FCM with the credentials
 * stored in the EAS project. EXPO_ACCESS_TOKEN is sent when set (for
 * "enhanced push security" in the EAS dashboard).
 *
 * Local development and tests: with EXPO_PUSH_OUTBOX=1 nothing is sent;
 * each message is appended to .data/dev-push/<token>.jsonl (like the email
 * dev mailbox), and the app repo's scripts/sim-push.mjs can deliver them to an iOS
 * Simulator.
 */

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
/** Expo takes up to 100 messages per request, 1000 receipt ids. */
const SEND_CHUNK = 100;
const RECEIPT_CHUNK = 1000;
const OUTBOX_DIR = path.join(process.cwd(), ".data", "dev-push");

export type ExpoMessage = {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  /** Android notification channel */
  channelId?: string;
  /** interactive actions (registered by the app) */
  categoryId?: string;
  /** iOS: stack these together */
  threadId?: string;
  /** replaces an earlier notification with the same id (iOS; Android in transit) */
  collapseId?: string;
  /** Android: replaces an already shown notification with the same tag */
  tag?: string;
  priority?: "default" | "normal" | "high";
  /** seconds */
  ttl?: number;
};

export type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

export type ExpoReceipt =
  | { status: "ok" }
  | { status: "error"; message: string; details?: { error?: string } };

export function pushOutboxEnabled(): boolean {
  return process.env.EXPO_PUSH_OUTBOX === "1";
}

/** Tokens as Expo issues them: ExponentPushToken[…] (or ExpoPushToken[…]). */
export function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 200 &&
    /^Expo(nent)?PushToken\[[A-Za-z0-9_\-:.]+\]$/.test(value)
  );
}

/** Development builds without an EAS project register "dev" tokens. */
export function isDevPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[dev-/.test(token);
}

/** Outbox tickets (EXPO_PUSH_OUTBOX) have no receipts to fetch. */
export function isOutboxTicket(id: string): boolean {
  return id.startsWith("outbox-");
}

export class ExpoPushError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST with a timeout, retrying rate limits and server errors (3 tries). */
async function post<T>(url: string, body: unknown): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(500 * 2 ** attempt);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 429 || res.status >= 500) {
        last = new ExpoPushError(`Expo push ${res.status}`, res.status);
        continue;
      }
      const json = (await res.json().catch(() => null)) as {
        data?: T;
        errors?: { code: string; message: string }[];
      } | null;
      if (!res.ok || !json || json.data === undefined)
        throw new ExpoPushError(
          `Expo push ${res.status}: ${json?.errors?.map((e) => e.code).join(", ") ?? "no data"}`,
          res.status,
        );
      return json.data;
    } catch (e) {
      if (e instanceof ExpoPushError && e.status < 500 && e.status !== 429)
        throw e;
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function writeOutbox(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  await mkdir(OUTBOX_DIR, { recursive: true });
  const at = new Date().toISOString();
  const tickets: ExpoTicket[] = [];
  for (const [i, m] of messages.entries()) {
    const file = path.join(
      OUTBOX_DIR,
      `${m.to.replace(/[^A-Za-z0-9_-]/g, "_")}.jsonl`,
    );
    await appendFile(file, `${JSON.stringify({ at, ...m })}\n`);
    console.log(`[push:outbox] ${m.to} ${m.title ?? ""} — ${m.body ?? ""}`);
    tickets.push({ status: "ok", id: `outbox-${Date.now()}-${i}` });
  }
  return tickets;
}

/**
 * Send messages; returns one ticket per message, in order. Throws when a
 * whole request fails (network, credentials, Expo down) — callers fall back
 * to LINE / email.
 */
export async function sendExpoMessages(
  messages: readonly ExpoMessage[],
): Promise<ExpoTicket[]> {
  if (messages.length === 0) return [];
  if (pushOutboxEnabled()) return writeOutbox([...messages]);
  const tickets: ExpoTicket[] = [];
  for (let i = 0; i < messages.length; i += SEND_CHUNK) {
    const chunk = messages.slice(i, i + SEND_CHUNK);
    const data = await post<ExpoTicket[] | ExpoTicket>(SEND_URL, chunk);
    const list = Array.isArray(data) ? data : [data];
    if (list.length !== chunk.length)
      throw new ExpoPushError("Expo push: ticket count mismatch", 502);
    tickets.push(...list);
  }
  return tickets;
}

/** Delivery receipts for ticket ids (missing = not ready yet). */
export async function fetchExpoReceipts(
  ids: readonly string[],
): Promise<Record<string, ExpoReceipt>> {
  const out: Record<string, ExpoReceipt> = {};
  const real = ids.filter((id) => !isOutboxTicket(id));
  for (let i = 0; i < real.length; i += RECEIPT_CHUNK) {
    Object.assign(
      out,
      await post<Record<string, ExpoReceipt>>(RECEIPTS_URL, {
        ids: real.slice(i, i + RECEIPT_CHUNK),
      }),
    );
  }
  return out;
}
