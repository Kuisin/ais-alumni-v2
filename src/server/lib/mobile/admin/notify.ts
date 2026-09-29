import type {
  AdminBroadcast,
  AdminNotifyPage,
  BroadcastAudienceKey,
  BroadcastAudienceText,
  BroadcastHistoryItem,
  NotificationOpens,
} from "@contract/admin-notify";
import type {
  AudienceKey,
  BroadcastScope,
  RoleKey,
} from "@/server/generated/prisma/enums";
import { messageReceipts, receiptCounts } from "@/server/lib/announcements";
import { AUDIENCE_KEYS, effectiveAudiences } from "@/server/lib/audience";
import { getBroadcastRights } from "@/server/lib/broadcasts";
import { loadCohortOptions } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import { MESSAGES_ENABLED } from "@/server/lib/features";
import { displayName } from "@/server/lib/format";
import { staffOnly } from "@/server/lib/mobile/admin";
import { IdParam, type Locale, notFound } from "@/server/lib/mobile/http";
import type { NotifyKind } from "@/server/lib/notify/catalog";
import { notificationReceipts } from "@/server/lib/notify/receipts";
import type { CurrentUser } from "@/server/lib/session";

/**
 * Admin mode → 一斉通知 (the website's /app/admin/notify pages). The pages'
 * checks, in the same order: the admin layout's requireStaff() (staffOnly),
 * then MESSAGES_ENABLED, then the page's own (a send right for the send
 * page; the sender or an admin for a sent message). Mutations are the
 * website's server actions (src/server/app/actions/broadcasts.ts), which
 * check again.
 */

const HISTORY_SIZE = 30;

/** Who a message went to (the website's broadcastAudienceText). */
function audienceText(
  b: {
    scope: BroadcastScope;
    cohortId: string | null;
    targetRoles: RoleKey[];
    targetAudiences: AudienceKey[];
  },
  cohortName: (id: string) => string | undefined,
): BroadcastAudienceText {
  if (b.scope === "COHORT")
    return {
      kind: "cohort",
      label: (b.cohortId ? cohortName(b.cohortId) : undefined) ?? null,
    };
  const audiences = effectiveAudiences(b);
  return audiences.length
    ? { kind: "audiences", keys: audiences as BroadcastAudienceKey[] }
    : { kind: "all" };
}

/** The send page: the form's options and the history. */
export async function notifyPage(
  me: CurrentUser,
  all: boolean,
  locale: Locale,
): Promise<AdminNotifyPage> {
  await staffOnly(me);
  if (!MESSAGES_ENABLED) throw notFound();
  // Admin mode admits other positions too; this page needs a send right.
  const rights = await getBroadcastRights(me);
  if (rights.length === 0) throw notFound();
  const canAny = rights.some((r) => r.kind === "ANY");
  // Admins may look at every sender's messages (?all=1).
  const showAll = me.isAdmin && all;
  const leaderCohortIds = new Set(
    rights.flatMap((r) => (r.kind === "COHORT" ? [r.cohortId] : [])),
  );
  const allCohorts = await loadCohortOptions(locale);
  const cohorts = canAny
    ? allCohorts
    : allCohorts.filter((c) => leaderCohortIds.has(c.id));
  const cohortName = new Map(allCohorts.map((c) => [c.id, c.label]));
  const history = await db.broadcast.findMany({
    where: showAll ? {} : { senderId: me.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_SIZE,
    include: {
      sender: { select: { nameRomaji: true, nameKanji: true } },
    },
  });
  const counts = await receiptCounts(history.map((b) => b.id));

  return {
    canAny,
    isAdmin: me.isAdmin,
    showAll,
    cohorts: cohorts.map((c) => ({ id: c.id, label: c.label })),
    audienceKeys: [...AUDIENCE_KEYS] as BroadcastAudienceKey[],
    history: history.map(
      (b): BroadcastHistoryItem => ({
        id: b.id,
        title: b.title,
        createdAt: b.createdAt.toISOString(),
        archived: b.archivedAt !== null,
        edited: b.editedAt !== null,
        audience: audienceText(b, (id) => cohortName.get(id)),
        sender: showAll ? displayName(b.sender, locale) : null,
        recipientCount: b.recipientCount,
        lineCount: b.lineCount,
        emailCount: b.emailCount,
        receipts: counts.get(b.id) ?? null,
      }),
    ),
  };
}

/** 「通知の開封」 rows for one item (null when nothing was sent). */
export async function notificationOpens(
  kinds: NotifyKind[],
  refId: string,
  locale: Locale,
): Promise<NotificationOpens> {
  const receipts = await notificationReceipts(kinds, refId);
  if (receipts.opened.length + receipts.unopened.length === 0) return null;
  const row = (r: (typeof receipts.opened)[number]) => ({
    userId: r.user.id,
    name: displayName(r.user, locale),
    at: r.openedAt?.toISOString() ?? null,
    channels: [
      ...new Set(
        r.channels.map((c) => (c === "LINE" || c === "PUSH" ? c : "EMAIL")),
      ),
    ] as ("LINE" | "EMAIL" | "PUSH")[],
  });
  return {
    opened: receipts.opened.map(row),
    unopened: receipts.unopened.map(row),
  };
}

/** A sent message and who has read it: its sender or an admin only. */
export async function sentMessage(
  me: CurrentUser,
  rawId: string,
  locale: Locale,
): Promise<AdminBroadcast> {
  await staffOnly(me);
  if (!MESSAGES_ENABLED) throw notFound();
  const id = IdParam.safeParse(rawId);
  if (!id.success) throw notFound();
  const b = await db.broadcast.findUnique({
    where: { id: id.data },
    include: { sender: { select: { nameRomaji: true, nameKanji: true } } },
  });
  if (!b || (b.senderId !== me.id && !me.isAdmin)) throw notFound();

  const [receipts, cohorts, opens] = await Promise.all([
    messageReceipts(b.id),
    b.cohortId ? loadCohortOptions(locale) : Promise.resolve([]),
    notificationOpens(["BROADCAST"], b.id, locale),
  ]);
  const receipt = (r: (typeof receipts.read)[number]) => ({
    userId: r.user.id,
    name: displayName(r.user, locale),
    at: r.readAt?.toISOString() ?? null,
  });
  return {
    id: b.id,
    title: b.title,
    body: b.body,
    createdAt: b.createdAt.toISOString(),
    audience: audienceText(
      b,
      (cid) => cohorts.find((c) => c.id === cid)?.label,
    ),
    senderName: displayName(b.sender, locale),
    position: b.position,
    archived: b.archivedAt !== null,
    edited: b.editedAt !== null,
    receipts: {
      read: receipts.read.map(receipt),
      unread: receipts.unread.map(receipt),
    },
    opens,
  };
}
