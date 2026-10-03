import type {
  AdminLine,
  LineAnnouncePreview,
  LineAnnounceSent,
} from "@contract/admin-manage";
import { z } from "zod";
import { webPathFor } from "@/lib/site-paths";
import type { Prisma } from "@/server/generated/prisma/client";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import { lineConfigured, lineMulticast } from "@/server/lib/line";
import {
  RICH_MENU_ITEMS,
  RICH_MENU_REPLIES,
  richMenuStatus,
} from "@/server/lib/line-richmenu";
import {
  richMenuImage,
  richMenuLabels,
} from "@/server/lib/line-richmenu-image";
import { lineQuota, lineSendsByCategory } from "@/server/lib/line-usage";
import { ApiError } from "@/server/lib/mobile/http";

/**
 * LINE Official Account (the website's /app/admin/line; the caller checks
 * admin): this month's messages, the rich menu's state and its tiles.
 */
export async function loadAdminLine(): Promise<AdminLine> {
  const [status, ja, en, quota, byCategory, recipients] = await Promise.all([
    richMenuStatus(),
    richMenuLabels("ja"),
    richMenuLabels("en"),
    lineQuota(),
    lineSendsByCategory(new Date()),
    db.user.count({ where: ANNOUNCE_RECIPIENTS }),
  ]);
  const installed = Boolean(status.installed.ja);
  return {
    configured: status.configured,
    installed,
    isDefault: installed && status.defaultId === status.installed.ja,
    usage: { quota, byCategory },
    announce: { recipients, configured: lineConfigured() },
    previews: (
      [
        ["ja", ja],
        ["en", en],
      ] as const
    ).map(([locale, l]) => ({
      locale,
      image: `/api/mobile/v1/admin/line/preview?locale=${locale}`,
      imageDots: `/api/mobile/v1/admin/line/preview?locale=${locale}&chats=1&news=1`,
      replies: RICH_MENU_REPLIES.map((i) => ({
        key: i.key,
        label: l.labels[i.key],
      })),
      items: RICH_MENU_ITEMS.map((i) => ({
        key: i.key,
        label: l.labels[i.key],
        path: webPathFor(i.path),
      })),
    })),
  };
}

/** The menu image as uploaded (?chats=1 / ?news=1 show the unread dots). */
export async function richMenuPreview(
  params: Record<string, string>,
): Promise<Response> {
  const locale = params.locale === "en" ? "en" : "ja";
  const img = await richMenuImage(locale, {
    chats: params.chats === "1",
    news: params.news === "1",
  });
  return new Response(img.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}

// ---- 「LINE でお知らせ」: one text message to every member on LINE ----

/** The longest announcement (LINE itself allows 5000). */
export const ANNOUNCE_MAX = 1000;

/** No second announcement within this long of the last one. */
const ANNOUNCE_GAP_MS = 5 * 60_000;

export const ANNOUNCE_ACTION = "line.announcement_sent";

/** POST /admin/line/announce */
export const AnnounceSchema = z.object({
  intent: z.enum(["preview", "send"]),
  text: z.string().trim().min(1).max(ANNOUNCE_MAX),
  /** members using English get this one; absent / empty = `text` */
  textEn: z.string().trim().max(ANNOUNCE_MAX).optional(),
});

/**
 * Who an announcement reaches: approved members who linked LINE, follow the
 * Official Account, haven't chosen email only, and haven't turned off
 * ニュース notifications (an announcement is committee news).
 */
export const ANNOUNCE_RECIPIENTS = {
  state: "ACTIVE",
  deactivatedAt: null,
  lineUserId: { not: null },
  lineFollowing: true,
  notifyVia: { not: "EMAIL_ONLY" },
  NOT: { notifyOff: { has: "news" } },
} as const satisfies Prisma.UserWhereInput;

async function announceRecipients(): Promise<
  { lineUserId: string; english: boolean }[]
> {
  const rows = await db.user.findMany({
    where: ANNOUNCE_RECIPIENTS,
    select: { lineUserId: true, locale: true },
  });
  return rows.flatMap((r) =>
    r.lineUserId
      ? [{ lineUserId: r.lineUserId, english: r.locale === "en" }]
      : [],
  );
}

/** LINE's figures as the announcement's allowance (nulls when unknown). */
export function announceQuota(
  quota: { used: number; limit: number | null } | null,
): LineAnnouncePreview["quota"] {
  if (!quota) return { limit: null, used: 0, remaining: null };
  return {
    limit: quota.limit,
    used: quota.used,
    remaining:
      quota.limit === null ? null : Math.max(0, quota.limit - quota.used),
  };
}

/** How many it would reach and what is left of this month's allowance. */
export async function previewLineAnnouncement(): Promise<LineAnnouncePreview> {
  const [recipients, english, quota] = await Promise.all([
    db.user.count({ where: ANNOUNCE_RECIPIENTS }),
    db.user.count({ where: { ...ANNOUNCE_RECIPIENTS, locale: "en" } }),
    lineQuota(),
  ]);
  return { recipients, english, quota: announceQuota(quota) };
}

/**
 * Send it (the caller checked admin and parsed the texts): `textEn` to
 * members using English when given, `text` to everyone else.
 */
export async function sendLineAnnouncement(
  adminId: string,
  text: string,
  textEn?: string,
): Promise<LineAnnounceSent> {
  if (!lineConfigured()) throw new ApiError(400, "not_configured");
  const [recipients, quota, last] = await Promise.all([
    announceRecipients(),
    lineQuota(),
    db.auditLog.findFirst({
      where: { action: ANNOUNCE_ACTION },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  if (!recipients.length) throw new ApiError(400, "no_recipients");
  // One multicast list per text.
  const lists = textEn
    ? [
        {
          text,
          ids: recipients.filter((r) => !r.english).map((r) => r.lineUserId),
        },
        {
          text: textEn,
          ids: recipients.filter((r) => r.english).map((r) => r.lineUserId),
        },
      ]
    : [{ text, ids: recipients.map((r) => r.lineUserId) }];
  const total = recipients.length;
  const { remaining } = announceQuota(quota);
  if (remaining !== null && total > remaining) throw new ApiError(400, "quota");
  if (last && Date.now() - last.createdAt.getTime() < ANNOUNCE_GAP_MS)
    throw new ApiError(429, "too_soon");
  // LINE takes 500 recipients per request. Sent batch by batch so a failure
  // partway is recorded with how many got it — the log then blocks an
  // immediate retry (ANNOUNCE_GAP_MS), which would reach them twice.
  let sent = 0;
  try {
    for (const list of lists)
      for (let i = 0; i < list.ids.length; i += 500) {
        const batch = list.ids.slice(i, i + 500);
        await lineMulticast(batch, [{ type: "text", text: list.text }]);
        sent += batch.length;
      }
  } catch (e) {
    console.error("[line-announce] multicast failed", e);
    if (sent > 0)
      await audit(adminId, ANNOUNCE_ACTION, undefined, {
        recipients: sent,
        intended: total,
        partial: true,
        text,
        textEn,
      });
    throw new ApiError(502, "line_failed", { sent });
  }
  await audit(adminId, ANNOUNCE_ACTION, undefined, {
    recipients: sent,
    text,
    textEn,
  });
  return { sent };
}
