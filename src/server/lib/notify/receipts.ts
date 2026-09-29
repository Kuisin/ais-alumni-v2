import { db } from "@/server/lib/db";
import type { NotifyKind } from "./catalog";

export type NotificationReceiptRow = {
  user: { id: string; nameRomaji: string | null; nameKanji: string | null };
  channels: string[];
  sentAt: Date;
  openedAt: Date | null;
};

/**
 * Who was notified about one thing (e.g. a news post: NEWS and its
 * reminders) and who opened a notification link — one row per member,
 * merging their notifications (earliest send, earliest open).
 */
export async function notificationReceipts(
  kinds: NotifyKind[],
  refId: string,
): Promise<{
  opened: NotificationReceiptRow[];
  unopened: NotificationReceiptRow[];
}> {
  const rows = await db.notificationReceipt.findMany({
    where: { link: { kind: { in: kinds }, refId } },
    orderBy: { sentAt: "asc" },
    select: {
      channels: true,
      sentAt: true,
      openedAt: true,
      user: { select: { id: true, nameRomaji: true, nameKanji: true } },
    },
  });
  const byUser = new Map<string, NotificationReceiptRow>();
  for (const r of rows) {
    const cur = byUser.get(r.user.id);
    if (!cur) {
      byUser.set(r.user.id, { ...r, channels: [...r.channels] });
      continue;
    }
    for (const ch of r.channels)
      if (!cur.channels.includes(ch)) cur.channels.push(ch);
    if (r.openedAt && (!cur.openedAt || r.openedAt < cur.openedAt))
      cur.openedAt = r.openedAt;
  }
  const all = [...byUser.values()];
  return {
    opened: all
      .filter((r) => r.openedAt)
      .sort(
        (a, b) => (a.openedAt?.getTime() ?? 0) - (b.openedAt?.getTime() ?? 0),
      ),
    unopened: all.filter((r) => !r.openedAt),
  };
}
