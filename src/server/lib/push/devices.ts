import { Prisma } from "@/server/generated/prisma/client";
import { db } from "@/server/lib/db";

/**
 * App devices that receive push notifications: one per signed-in device
 * session (PushDevice.sessionId) that allowed notifications. A device is
 * used while it's enabled, its token hasn't been reported dead and its
 * session hasn't expired; signing the device out removes it (cascade).
 */

export type PushTarget = {
  id: string;
  userId: string;
  token: string;
  platform: string | null;
};

const usable = (now: Date) =>
  ({
    enabled: true,
    failedAt: null,
    session: { expiresAt: { gt: now } },
  }) satisfies Prisma.PushDeviceWhereInput;

/** The members' usable devices (members without one are absent). */
export async function pushTargetsFor(
  userIds: readonly string[],
): Promise<Map<string, PushTarget[]>> {
  const out = new Map<string, PushTarget[]>();
  if (userIds.length === 0) return out;
  const rows = await db.pushDevice.findMany({
    where: { userId: { in: [...new Set(userIds)] }, ...usable(new Date()) },
    select: { id: true, userId: true, token: true, platform: true },
  });
  for (const r of rows) out.set(r.userId, [...(out.get(r.userId) ?? []), r]);
  return out;
}

/** Members (of these) who get app notifications on at least one device. */
export async function membersWithPush(
  userIds: readonly string[],
): Promise<Set<string>> {
  return new Set((await pushTargetsFor(userIds)).keys());
}

export type PushDeviceRow = {
  id: string;
  enabled: boolean;
  platform: string | null;
  failedAt: Date | null;
  createdAt: Date;
};

const ROW = {
  id: true,
  enabled: true,
  platform: true,
  failedAt: true,
  createdAt: true,
} as const;

/** This device session's registration, if any. */
export function pushDeviceFor(
  sessionId: string,
): Promise<PushDeviceRow | null> {
  return db.pushDevice.findUnique({ where: { sessionId }, select: ROW });
}

/**
 * Register (or update) the token for this device session. A token belongs
 * to one app install: if another session had it (the phone was signed in to
 * another account, or signed in again), that registration is removed first.
 */
export async function registerPushDevice(input: {
  sessionId: string;
  userId: string;
  token: string;
  platform: "ios" | "android";
  enabled: boolean;
}): Promise<PushDeviceRow> {
  const data = {
    userId: input.userId,
    token: input.token,
    platform: input.platform,
    enabled: input.enabled,
    failedAt: null,
  };
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        await tx.pushDevice.deleteMany({
          where: { token: input.token, sessionId: { not: input.sessionId } },
        });
        return tx.pushDevice.upsert({
          where: { sessionId: input.sessionId },
          create: { sessionId: input.sessionId, ...data },
          update: data,
          select: ROW,
        });
      });
    } catch (e) {
      // Two registrations of one token racing: the unique index wins; retry.
      if (
        attempt < 2 &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        continue;
      throw e;
    }
  }
}

/** This device stops getting app notifications. */
export async function removePushDevice(sessionId: string): Promise<void> {
  await db.pushDevice.deleteMany({ where: { sessionId } });
}

/** Expo said these tokens can't receive anything anymore. */
export async function retirePushDevices(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.pushDevice.updateMany({
    where: { id: { in: [...ids] }, failedAt: null },
    data: { failedAt: new Date() },
  });
}

/** Devices (name, platform, since) a member gets app notifications on. */
export async function pushDevicesOf(
  userId: string,
): Promise<{ deviceName: string | null; platform: string | null }[]> {
  const rows = await db.pushDevice.findMany({
    where: { userId, ...usable(new Date()) },
    orderBy: { createdAt: "asc" },
    select: { platform: true, session: { select: { deviceName: true } } },
  });
  return rows.map((r) => ({
    deviceName: r.session.deviceName,
    platform: r.platform,
  }));
}
