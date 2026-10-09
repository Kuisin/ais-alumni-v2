import { db } from "@/server/lib/db";
import { type PushTarget, retirePushDevices } from "./devices";
import { type ExpoMessage, isOutboxTicket, sendExpoMessages } from "./expo";
import { sendWebPushes } from "./web";

export type PushDelivery = {
  userId: string;
  targets: readonly PushTarget[];
  /** the message for one device (its token is filled in per device) */
  message: Omit<ExpoMessage, "to">;
};

/**
 * Send to every device of each member in one go. Returns the members at
 * least one device accepted; the rest (every device failed, or the whole
 * request did) are for the caller to reach another way. Expo's tickets are
 * kept for the push-receipts job; tokens Expo reports dead, and browser
 * subscriptions that are gone, are retired.
 */
export async function deliverPushes(
  deliveries: readonly PushDelivery[],
): Promise<Set<string>> {
  const reached = new Set<string>();
  const sends = deliveries.flatMap((d) =>
    d.targets.map((t) => ({
      userId: d.userId,
      device: t,
      message: { ...d.message, to: t.token } satisfies ExpoMessage,
    })),
  );
  if (sends.length === 0) return reached;
  // Browsers (Web Push) and the apps (Expo) are sent separately; one
  // failing as a whole doesn't stop the other.
  const web = sends.filter((s) => s.device.platform === "web");
  const app = sends.filter((s) => s.device.platform !== "web");
  const ok: { id: string; deviceId: string }[] = [];
  const dead: string[] = [];
  const sent: string[] = [];

  const [tickets, results] = await Promise.all([
    sendExpoMessages(app.map((s) => s.message)).catch((e) => {
      console.error("[push] send failed", e);
      return null;
    }),
    sendWebPushes(
      web.map((s) => ({
        to: {
          endpoint: s.device.token,
          p256dh: s.device.webP256dh ?? "",
          auth: s.device.webAuth ?? "",
        },
        payload: {
          title: s.message.title ?? "",
          body: s.message.body ?? "",
          data: s.message.data ?? {},
          ...(s.message.tag ? { tag: s.message.tag } : {}),
          ...(typeof s.message.badge === "number"
            ? { badge: s.message.badge }
            : {}),
        },
        ttl: s.message.ttl,
        urgent: s.message.priority === "high",
      })),
    ),
  ]);
  for (const [i, t] of (tickets ?? []).entries()) {
    const s = app[i];
    if (t.status === "ok") {
      reached.add(s.userId);
      sent.push(s.device.id);
      if (!isOutboxTicket(t.id)) ok.push({ id: t.id, deviceId: s.device.id });
    } else if (t.details?.error === "DeviceNotRegistered") {
      dead.push(s.device.id);
    } else {
      console.error(`[push] ${s.device.id}: ${t.message}`);
    }
  }
  for (const [i, r] of results.entries()) {
    const s = web[i];
    if (r.status === "ok") {
      reached.add(s.userId);
      sent.push(s.device.id);
    } else if (r.status === "gone") {
      dead.push(s.device.id);
    } else {
      console.error(`[push] ${s.device.id}: ${r.message}`);
    }
  }
  await Promise.all([
    ok.length
      ? db.pushTicket.createMany({ data: ok, skipDuplicates: true })
      : null,
    retirePushDevices(dead),
    sent.length
      ? db.pushDevice.updateMany({
          where: { id: { in: sent } },
          data: { lastSentAt: new Date() },
        })
      : null,
  ]).catch((e) => console.error("[push] bookkeeping failed", e));
  return reached;
}
