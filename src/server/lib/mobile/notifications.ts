import type {
  ChatNotifyLevel,
  InboxItem,
  InboxPage,
  PushState,
} from "@contract/notifications";
import { z } from "zod";
import type { Prisma } from "@/server/generated/prisma/client";
import { ChatGroupKind } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { db } from "@/server/lib/db";
import { ApiError, notFound } from "@/server/lib/mobile/http";
import { NOTIFY_KINDS } from "@/server/lib/notify/catalog";
import { linkText } from "@/server/lib/notify/links";
import {
  pushDeviceFor,
  pushTargetsFor,
  registerPushDevice,
  removePushDevice,
} from "@/server/lib/push/devices";
import {
  isDevPushToken,
  isExpoPushToken,
  pushOutboxEnabled,
} from "@/server/lib/push/expo";
import { pushMessageFor } from "@/server/lib/push/message";
import { deliverPushes } from "@/server/lib/push/send";
import { isWebPushEndpoint, webPushPublicKey } from "@/server/lib/push/web";
import type { CurrentUser } from "@/server/lib/session";

/**
 * App notifications for the mobile API: this device's push registration,
 * a test push, the notification list (the member's NotificationReceipt
 * rows — every notification sent to them with a link, whatever the
 * channel) and chat notification levels.
 */

type Session = { id: string; userId: string };

// ---- this device ----

export async function pushState(session: Session): Promise<PushState> {
  const [device, others] = await Promise.all([
    pushDeviceFor(session.id),
    pushTargetsFor([session.userId]),
  ]);
  const otherDevices = (others.get(session.userId) ?? []).filter(
    (d) => d.id !== device?.id,
  ).length;
  return {
    devTokens: pushOutboxEnabled(),
    webPushKey: webPushPublicKey(),
    device: device
      ? {
          enabled: device.enabled,
          platform: device.platform,
          failed: device.failedAt !== null,
          since: device.createdAt.toISOString(),
        }
      : null,
    otherDevices,
  };
}

export const RegisterBody = z.object({
  /** the apps: the Expo push token */
  token: z.string().max(200).optional(),
  platform: z.enum(["ios", "android", "web"]),
  /** "web": the browser's PushSubscription (toJSON()) */
  subscription: z
    .object({
      endpoint: z.string().max(1000),
      keys: z.object({
        p256dh: z.string().min(1).max(200),
        auth: z.string().min(1).max(100),
      }),
    })
    .optional(),
  enabled: z.boolean().default(true),
});

export async function registerDevice(
  session: Session,
  body: z.infer<typeof RegisterBody>,
): Promise<PushState> {
  if (body.platform === "web") {
    const sub = body.subscription;
    if (!sub || !isWebPushEndpoint(sub.endpoint))
      throw new ApiError(400, "invalid_token");
    if (!webPushPublicKey()) throw new ApiError(400, "push_unavailable");
    await registerPushDevice({
      sessionId: session.id,
      userId: session.userId,
      token: sub.endpoint,
      platform: "web",
      web: sub.keys,
      enabled: body.enabled,
    });
    return pushState(session);
  }
  if (!isExpoPushToken(body.token)) throw new ApiError(400, "invalid_token");
  // Development builds without an EAS project use made-up tokens that only
  // the local outbox can "deliver".
  if (isDevPushToken(body.token) && !pushOutboxEnabled())
    throw new ApiError(400, "push_unavailable");
  await registerPushDevice({
    sessionId: session.id,
    userId: session.userId,
    token: body.token,
    platform: body.platform,
    enabled: body.enabled,
  });
  return pushState(session);
}

export async function unregisterDevice(session: Session): Promise<PushState> {
  await removePushDevice(session.id);
  return pushState(session);
}

/** A test notification to this device (at most one every 20 seconds). */
export async function sendTestPush(
  session: Session,
  locale: "ja" | "en",
): Promise<{ ok: true }> {
  const device = await db.pushDevice.findUnique({
    where: { sessionId: session.id },
    select: {
      id: true,
      userId: true,
      token: true,
      platform: true,
      webP256dh: true,
      webAuth: true,
      enabled: true,
      failedAt: true,
      lastSentAt: true,
    },
  });
  if (!device || !device.enabled || device.failedAt)
    throw new ApiError(409, "not_registered");
  if (device.lastSentAt && Date.now() - device.lastSentAt.getTime() < 20_000)
    throw new ApiError(429, "too_soon");
  const t = await getTranslatorFor(locale, "notifications");
  const { to: _to, ...message } = pushMessageFor({
    token: device.token,
    kind: "TEST",
    category: "account",
    emoji: "🔔",
    title: t("push.testTitle"),
    body: t("push.testBody"),
    path: "/app/settings",
  });
  const reached = await deliverPushes([
    { userId: device.userId, targets: [device], message },
  ]);
  if (!reached.has(device.userId)) throw new ApiError(502, "send_failed");
  return { ok: true };
}

// ---- the notification list ----

const PAGE = 30;
const UNREAD_DAYS = 14;

/** Not listed: chats have their own unread marks. */
const LISTED = {
  link: { category: { not: "chat" } },
} satisfies Prisma.NotificationReceiptWhereInput;

function unreadWhere(userId: string): Prisma.NotificationReceiptWhereInput {
  return {
    userId,
    ...LISTED,
    seenAt: null,
    openedAt: null,
    sentAt: { gt: new Date(Date.now() - UNREAD_DAYS * 86_400_000) },
  };
}

export function inboxUnread(userId: string): Promise<number> {
  return db.notificationReceipt.count({ where: unreadWhere(userId) });
}

/** cursor = "<ISO sentAt>_<receipt id>" of the last item shown. */
function parseCursor(v: unknown): { sentAt: Date; id: string } | null {
  if (typeof v !== "string" || v.length > 120) return null;
  const i = v.lastIndexOf("_");
  if (i < 0) return null;
  const sentAt = new Date(v.slice(0, i));
  const id = v.slice(i + 1);
  if (Number.isNaN(sentAt.getTime()) || !id) return null;
  return { sentAt, id };
}

export async function inboxPage(
  user: CurrentUser,
  cursorRaw: unknown,
  locale: "ja" | "en",
): Promise<InboxPage> {
  const cursor = parseCursor(cursorRaw);
  const rows = await db.notificationReceipt.findMany({
    where: {
      userId: user.id,
      ...LISTED,
      ...(cursor
        ? {
            OR: [
              { sentAt: { lt: cursor.sentAt } },
              { sentAt: cursor.sentAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ sentAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    select: {
      id: true,
      channels: true,
      sentAt: true,
      seenAt: true,
      openedAt: true,
      link: {
        select: {
          kind: true,
          category: true,
          path: true,
          texts: true,
          title: true,
          body: true,
        },
      },
    },
  });
  const page = rows.slice(0, PAGE);
  const items: InboxItem[] = page.map((r) => {
    const text = linkText(r.link, locale);
    const spec = NOTIFY_KINDS[r.link.kind as keyof typeof NOTIFY_KINDS];
    return {
      id: r.id,
      kind: r.link.kind,
      category: r.link.category,
      emoji: spec?.emoji ?? "🔔",
      title: text.title,
      body: text.body,
      path: r.link.path || null,
      sentAt: r.sentAt.toISOString(),
      read: Boolean(r.seenAt || r.openedAt),
      channels: r.channels,
    };
  });
  const last = page[page.length - 1];
  return {
    items,
    nextCursor:
      rows.length > PAGE && last
        ? `${last.sentAt.toISOString()}_${last.id}`
        : null,
    unread: await inboxUnread(user.id),
  };
}

export const ReadBody = z.object({
  ids: z.array(z.string().max(64)).max(200).optional(),
});

export async function markInboxSeen(
  user: CurrentUser,
  body: z.infer<typeof ReadBody>,
): Promise<{ unread: number }> {
  await db.notificationReceipt.updateMany({
    where: {
      userId: user.id,
      seenAt: null,
      ...(body.ids ? { id: { in: body.ids } } : {}),
    },
    data: { seenAt: new Date() },
  });
  return { unread: await inboxUnread(user.id) };
}

export const OpenBody = z
  .object({
    token: z
      .string()
      .regex(/^[0-9A-Za-z]{8}$/)
      .optional(),
    id: z.string().max(64).optional(),
  })
  .refine((b) => Boolean(b.token) !== Boolean(b.id));

/**
 * The member opened a notification (tapped the push, or the list entry):
 * recorded like opening its short link (read receipt), and seen.
 */
export async function openNotification(
  user: CurrentUser,
  body: z.infer<typeof OpenBody>,
): Promise<{ path: string | null }> {
  const receipt = await db.notificationReceipt.findFirst({
    where: body.id
      ? { id: body.id, userId: user.id }
      : { userId: user.id, link: { token: body.token } },
    select: {
      id: true,
      openedAt: true,
      linkId: true,
      link: { select: { path: true } },
    },
  });
  if (!receipt) throw notFound();
  const now = new Date();
  await Promise.all([
    db.notificationReceipt.update({
      where: { id: receipt.id },
      data: {
        opens: { increment: 1 },
        lastOpenedAt: now,
        openedAt: receipt.openedAt ?? now,
        seenAt: now,
      },
    }),
    db.notificationLink.update({
      where: { id: receipt.linkId },
      data: { opens: { increment: 1 }, lastOpenedAt: now },
    }),
  ]);
  return { path: receipt.link.path || null };
}

// ---- chat notification levels ----

export const NotifyLevelBody = z.object({
  level: z.enum(["all", "mentions", "off"]),
});

export function chatNotifyLevel(member: {
  muted: boolean;
  pushAll: boolean;
}): ChatNotifyLevel {
  if (member.muted) return "off";
  return member.pushAll ? "all" : "mentions";
}

export async function setChatNotifyLevel(
  user: CurrentUser,
  groupId: string,
  level: ChatNotifyLevel,
): Promise<{ level: ChatNotifyLevel }> {
  const member = await db.chatMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
    select: { group: { select: { kind: true } } },
  });
  if (!member) throw notFound();
  if (member.group.kind === ChatGroupKind.DIRECT)
    throw new ApiError(400, "direct");
  await db.chatMember.update({
    where: { groupId_userId: { groupId, userId: user.id } },
    data: { muted: level === "off", pushAll: level === "all" },
  });
  return { level };
}
