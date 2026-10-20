import webpush from "web-push";

/**
 * Web Push (RFC 8030 / VAPID) for the web app in a browser or installed to
 * the home screen (Android's "Install app"): the browser's subscription
 * (endpoint + keys) is the device, and we send straight to the browser
 * vendor's push service — no Expo in between. The service worker
 * (public/sw.js) shows what arrives.
 *
 * Needs a VAPID key pair on the server (`npx web-push generate-vapid-keys`):
 * WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY. Without them the web app
 * doesn't offer notifications.
 */

export type WebPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** What the service worker gets (public/sw.js reads these names). */
export type WebPushPayload = {
  title: string;
  body: string;
  /** PushData (src/server/lib/push/message.ts) */
  data: Record<string, unknown>;
  /** replaces a shown notification with the same tag */
  tag?: string;
  /** the home-screen icon's number */
  badge?: number;
};

export type WebPushResult =
  | { status: "ok" }
  /** the subscription is gone (unsubscribed, expired): don't use it again */
  | { status: "gone" }
  | { status: "error"; message: string };

type Keys = { publicKey: string; privateKey: string };

function keys(): Keys | null {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  return publicKey && privateKey ? { publicKey, privateKey } : null;
}

/** The key browsers subscribe with (null = Web Push isn't set up). */
export function webPushPublicKey(): string | null {
  return keys()?.publicKey ?? null;
}

/**
 * The browsers' push services. The endpoint comes from the member's
 * browser and we send requests to it, so anything else is refused — the
 * server must not be made to call arbitrary hosts.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge (Android / desktop), Samsung
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge (Windows)
  /^[a-z0-9-]+\.push\.apple\.com$/, // Safari
];

/** A push service's https URL, no credentials or port, a sane length. */
export function isWebPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      PUSH_HOSTS.some((re) => re.test(url.hostname))
    );
  } catch {
    return false;
  }
}

/** VAPID's contact: who a push service can reach about our traffic. */
function subject(): string {
  const email = process.env.SUPPORT_EMAIL?.trim();
  if (email) return `mailto:${email}`;
  return (
    process.env.PUBLIC_SITE_URL?.trim() || "https://ais-alumni.kai-lab.net"
  );
}

/** One result per message, in order; never throws. */
export async function sendWebPushes(
  messages: readonly {
    to: WebPushSubscription;
    payload: WebPushPayload;
    /** seconds the push service keeps trying (default 4 weeks) */
    ttl?: number;
    urgent?: boolean;
  }[],
): Promise<WebPushResult[]> {
  const k = keys();
  if (!k)
    return messages.map(() => ({
      status: "error",
      message: "Web Push isn't configured",
    }));
  return Promise.all(
    messages.map(async (m): Promise<WebPushResult> => {
      try {
        await webpush.sendNotification(
          {
            endpoint: m.to.endpoint,
            keys: { p256dh: m.to.p256dh, auth: m.to.auth },
          },
          JSON.stringify(m.payload),
          {
            vapidDetails: { subject: subject(), ...k },
            TTL: m.ttl ?? 28 * 86_400,
            urgency: m.urgent ? "high" : "normal",
            timeout: 10_000,
            ...(m.payload.tag ? { topic: topicFor(m.payload.tag) } : {}),
          },
        );
        return { status: "ok" };
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return { status: "gone" };
        return {
          status: "error",
          message: `Web Push ${status ?? ""}: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }),
  );
}

/**
 * The Topic header (replaces an undelivered push about the same thing):
 * at most 32 URL-safe base64 characters.
 */
function topicFor(tag: string): string {
  return Buffer.from(tag).toString("base64url").slice(0, 32);
}
