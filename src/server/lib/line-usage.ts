import { db } from "@/server/lib/db";
import { lineConfigured, lineRequest } from "@/server/lib/line";
import {
  NOTIFY_KINDS,
  type NotifyCategory,
  type NotifyKind,
} from "@/server/lib/notify/catalog";

// LINE counts push / multicast messages per recipient against the plan's
// monthly allowance (free plan: 200); replies are free. The month runs in
// Japan time.

export type LineQuota = {
  /** messages sent this month, as counted by LINE */
  used: number;
  /** the month's limit (free + additional), null when none is set */
  limit: number | null;
};

/** Kinds logged before the catalog's current names (Sept 2026). */
const LEGACY_KINDS: Record<string, NotifyCategory> = {
  VERIFICATION: "account",
  FAMILY_LINK_REQUEST: "family",
  NAME_REQUEST_RESULT: "account",
  BIRTH_DATE_REQUEST_RESULT: "account",
  GENDER_REQUEST_RESULT: "account",
  RECORD_REQUEST_RESULT: "account",
};

/** Start of the current month in Japan time, as a UTC instant. */
export function jstMonthStart(now: Date): Date {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  return new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 3600_000,
  );
}

/** LINE's own figures for this month; null when LINE isn't set up or fails. */
export async function lineQuota(): Promise<LineQuota | null> {
  if (!lineConfigured()) return null;
  try {
    const [quota, consumption] = await Promise.all([
      lineRequest<{ type: "none" | "limited"; value?: number }>(
        "GET",
        "/message/quota",
      ),
      lineRequest<{ totalUsage: number }>("GET", "/message/quota/consumption"),
    ]);
    return {
      used: consumption.totalUsage,
      limit: quota.type === "limited" ? (quota.value ?? null) : null,
    };
  } catch (e) {
    console.error("[line-usage] quota request failed", e);
    return null;
  }
}

/**
 * LINE messages this app sent this month (NotificationLog), by notification
 * category, most first. Every paid LINE message goes through notify().
 */
export async function lineSendsByCategory(
  now: Date,
): Promise<{ category: NotifyCategory | "other"; count: number }[]> {
  const rows = await db.notificationLog.groupBy({
    by: ["kind"],
    where: { channel: "LINE", sentAt: { gte: jstMonthStart(now) } },
    _count: { _all: true },
  });
  const byCategory = new Map<NotifyCategory | "other", number>();
  for (const r of rows) {
    const spec = NOTIFY_KINDS[r.kind as NotifyKind];
    const key = spec?.category ?? LEGACY_KINDS[r.kind] ?? "other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + r._count._all);
  }
  return [...byCategory]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
