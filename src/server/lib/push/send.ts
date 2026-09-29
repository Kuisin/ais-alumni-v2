import { db } from "@/server/lib/db";
import { type PushTarget, retirePushDevices } from "./devices";
import { type ExpoMessage, isOutboxTicket, sendExpoMessages } from "./expo";

export type PushDelivery = {
  userId: string;
  targets: readonly PushTarget[];
  /** the message for one device (its token is filled in per device) */
  message: Omit<ExpoMessage, "to">;
};

/**
 * Send to every device of each member in one go. Returns the members at
 * least one device accepted; the rest (every device failed, or the whole
 * request did) are for the caller to reach another way. Tickets are kept
 * for the push-receipts job; tokens Expo reports dead are retired.
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
  let tickets: Awaited<ReturnType<typeof sendExpoMessages>>;
  try {
    tickets = await sendExpoMessages(sends.map((s) => s.message));
  } catch (e) {
    console.error("[push] send failed", e);
    return reached;
  }
  const ok: { id: string; deviceId: string }[] = [];
  const dead: string[] = [];
  for (const [i, t] of tickets.entries()) {
    const s = sends[i];
    if (t.status === "ok") {
      reached.add(s.userId);
      if (!isOutboxTicket(t.id)) ok.push({ id: t.id, deviceId: s.device.id });
    } else if (t.details?.error === "DeviceNotRegistered") {
      dead.push(s.device.id);
    } else {
      console.error(`[push] ${s.device.id}: ${t.message}`);
    }
  }
  await Promise.all([
    ok.length
      ? db.pushTicket.createMany({ data: ok, skipDuplicates: true })
      : null,
    retirePushDevices(dead),
    db.pushDevice.updateMany({
      where: {
        id: {
          in: sends
            .filter((s) => reached.has(s.userId))
            .map((s) => s.device.id),
        },
      },
      data: { lastSentAt: new Date() },
    }),
  ]).catch((e) => console.error("[push] bookkeeping failed", e));
  return reached;
}
