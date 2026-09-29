import type {
  AdminAudienceSummary,
  AdminEventDetail,
  AdminEventList,
  AdminEventRow,
  AdminEventStatus,
  AdminReceipt,
  AdminStaffCandidate,
} from "@contract/admin-events";
import { z } from "zod";
import {
  approveEventAction,
  deleteEventAction,
  searchAudienceMembersAction,
  setEventRsvpClosedAction,
} from "@/server/app/actions/admin-content";
import { setEventStaffAction } from "@/server/app/actions/check-in";
import type { Prisma } from "@/server/generated/prisma/client";
import { RsvpAnswer } from "@/server/generated/prisma/enums";
import { awaitingApproval } from "@/server/lib/approval";
import { audit } from "@/server/lib/audit";
import { getNewsApprover } from "@/server/lib/broadcasts";
import { db } from "@/server/lib/db";
import { eventWorkbook } from "@/server/lib/event-xlsx";
import {
  answerSummary,
  headcount,
  rsvpClosesAt,
  toCsv,
} from "@/server/lib/events";
import { displayName, localized, toJstLocalInput } from "@/server/lib/format";
import { staffOnly } from "@/server/lib/mobile/admin";
import { IdParam, type Locale, notFound } from "@/server/lib/mobile/http";
import { iso } from "@/server/lib/mobile/present";
import {
  type AudienceSpec,
  isEveryone,
  specFromPost,
} from "@/server/lib/news-audience";
import {
  type NotificationReceiptRow,
  notificationReceipts,
} from "@/server/lib/notify/receipts";
import {
  AuthError,
  actionActive,
  actionNewsAuthor,
  type CurrentUser,
} from "@/server/lib/session";

/**
 * 管理モード → イベント管理 for the app: the website's /app/admin/events
 * pages (src/app/[locale]/app/admin/events) with the same queries, and their
 * server actions (src/server/app/actions/admin-content.ts, check-in.ts) for
 * every change — each action re-checks its own rights.
 */

/**
 * The pages' guard as an API check: admin mode (the admin layout's
 * requireStaff()) and a ニュース/イベント author (requireNewsAuthor()).
 * Throws AuthError → 403 instead of redirecting.
 */
export async function eventsAdmin(): Promise<{
  user: CurrentUser;
}> {
  await staffOnly(await actionActive());
  const { user } = await actionNewsAuthor();
  return { user };
}

const PAST_LIMIT = 30;

export function audienceSummary(spec: AudienceSpec): AdminAudienceSummary {
  return {
    everyone: isEveryone(spec),
    groups: [...spec.groups],
    cohorts: spec.cohortIds.length,
    includeParents: spec.includeParents,
    users: spec.userIds.length,
  };
}

/** GET /admin/events — as AdminEventsPage. */
export async function adminEventList(locale: Locale): Promise<AdminEventList> {
  const { user } = await eventsAdmin();
  const now = new Date();
  // Admins see every event; other authors their own, and 同窓会委員 also the
  // 同窓会委員 events they may approve.
  const mine: Prisma.EventWhereInput = user.isAdmin
    ? {}
    : (await getNewsApprover(user))
      ? { OR: [{ createdById: user.id }, { approvalRequired: true }] }
      : { createdById: user.id };

  const select = {
    id: true,
    titleJa: true,
    titleEn: true,
    startsAt: true,
    capacity: true,
    rsvpDeadline: true,
    targetRoles: true,
    targetAudiences: true,
    audience: true,
    approvalRequired: true,
    approvedAt: true,
    rsvps: { where: { answer: RsvpAnswer.GOING }, select: { guests: true } },
  } as const;
  const [upcoming, past] = await Promise.all([
    db.event.findMany({
      where: { ...mine, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      select,
    }),
    db.event.findMany({
      where: { ...mine, startsAt: { lt: now } },
      orderBy: { startsAt: "desc" },
      take: PAST_LIMIT,
      select,
    }),
  ]);

  const row = (
    e: (typeof upcoming)[number],
    isPast: boolean,
  ): AdminEventRow => {
    const going = e.rsvps.reduce((n, r) => n + 1 + r.guests, 0);
    const status: AdminEventStatus | null = isPast
      ? null
      : e.capacity !== null && going >= e.capacity
        ? "full"
        : e.rsvpDeadline && e.rsvpDeadline < now
          ? "closed"
          : "open";
    return {
      id: e.id,
      title: localized(e.titleJa, e.titleEn, locale),
      startsAt: e.startsAt.toISOString(),
      capacity: e.capacity,
      going,
      status,
      awaitingApproval: awaitingApproval(e),
      audience: audienceSummary(specFromPost(e)),
    };
  };

  return {
    isAdmin: user.isAdmin,
    upcoming: upcoming.map((e) => row(e, false)),
    past: past.map((e) => row(e, true)),
    pastLimit: PAST_LIMIT,
  };
}

const ANSWER_ORDER = { GOING: 0, MAYBE: 1, NOT_GOING: 2 } as const;

/** GET /admin/events/:id — as AdminEventPage. */
export async function adminEventDetail(
  rawId: string,
  locale: Locale,
): Promise<AdminEventDetail> {
  const { user } = await eventsAdmin();
  const id = IdParam.safeParse(rawId);
  if (!id.success) throw notFound();
  const event = await db.event.findUnique({
    where: { id: id.data },
    include: {
      rsvps: {
        orderBy: { updatedAt: "desc" },
        include: {
          user: { select: { id: true, nameRomaji: true, nameKanji: true } },
        },
      },
      checkIns: { select: { userId: true, checkedInAt: true } },
      staff: {
        orderBy: { createdAt: "asc" },
        select: {
          user: { select: { id: true, nameRomaji: true, nameKanji: true } },
        },
      },
    },
  });
  if (!event) throw notFound();
  // Teachers, 同窓会委員 and 学年代表 manage only their own events; other
  // 同窓会委員 may open a 同窓会委員's event to approve it (view only).
  const canEdit = user.isAdmin || event.createdById === user.id;
  const approver = await getNewsApprover(user);
  if (!canEdit && !(approver && event.approvalRequired)) throw notFound();

  const approvedBy = event.approvedById
    ? await db.user.findUnique({
        where: { id: event.approvedById },
        select: { nameRomaji: true, nameKanji: true },
      })
    : null;

  const base = {
    id: event.id,
    title: localized(event.titleJa, event.titleEn, locale).text,
    startsAt: event.startsAt.toISOString(),
    event: {
      titleJa: event.titleJa,
      titleEn: event.titleEn,
      bodyJa: event.bodyJa,
      bodyEn: event.bodyEn,
      startsAt: event.startsAt.toISOString(),
      endsAt: iso(event.endsAt),
      location: event.location,
      mapUrl: event.mapUrl,
      capacity: event.capacity,
      rsvpDeadline: iso(event.rsvpDeadline),
    },
    audience: audienceSummary(specFromPost(event)),
    approval: event.approvalRequired
      ? {
          approvedAt: iso(event.approvedAt),
          approvedBy: approvedBy
            ? (approvedBy.nameKanji ?? approvedBy.nameRomaji ?? "—")
            : null,
          canApprove: approver && event.createdById !== user.id,
        }
      : null,
    canEdit,
  };
  if (!canEdit) return { ...base, manage: null };

  const checkedIn = new Map(
    event.checkIns.map((c) => [c.userId, c.checkedInAt]),
  );
  const rsvps = [...event.rsvps].sort(
    (a, b) => ANSWER_ORDER[a.answer] - ANSWER_ORDER[b.answer],
  );
  const audience = specFromPost(event);
  const audienceMembers = audience.userIds.length
    ? await db.user.findMany({
        where: { id: { in: audience.userIds } },
        select: { id: true, nameRomaji: true, nameKanji: true },
      })
    : [];
  const receipts = await notificationReceipts(
    ["EVENT_REMINDER_7D", "EVENT_REMINDER_1D"],
    event.id,
  );
  const receipt = (r: NotificationReceiptRow): AdminReceipt => ({
    userId: r.user.id,
    name: displayName(r.user, locale),
    channels: r.channels,
    openedAt: iso(r.openedAt),
  });

  return {
    ...base,
    manage: {
      headcount: headcount(event.rsvps),
      checkedIn: event.checkIns.length,
      summary: answerSummary(event.rsvps),
      rsvps: rsvps.map((r) => ({
        id: r.id,
        userId: r.user.id,
        name: displayName(r.user, locale),
        answer: r.answer,
        guests: r.guests,
        updatedAt: r.updatedAt.toISOString(),
        checkedInAt: iso(checkedIn.get(r.user.id)),
      })),
      rsvpClosedAt: iso(event.rsvpClosedAt),
      rsvpDeadline: iso(rsvpClosesAt(event)),
      opens:
        receipts.opened.length + receipts.unopened.length > 0
          ? {
              opened: receipts.opened.map(receipt),
              unopened: receipts.unopened.map(receipt),
            }
          : null,
      staff: event.staff.map(({ user: u }) => ({
        id: u.id,
        name: u.nameRomaji ?? u.nameKanji ?? "—",
        kanji: u.nameRomaji ? u.nameKanji : null,
      })),
      values: {
        id: event.id,
        titleJa: event.titleJa ?? "",
        titleEn: event.titleEn ?? "",
        bodyJa: event.bodyJa ?? "",
        bodyEn: event.bodyEn ?? "",
        startsAt: toJstLocalInput(event.startsAt),
        endsAt: event.endsAt ? toJstLocalInput(event.endsAt) : "",
        rsvpDeadline: event.rsvpDeadline
          ? toJstLocalInput(event.rsvpDeadline)
          : "",
        location: event.location ?? "",
        mapUrl: event.mapUrl ?? "",
        capacity: event.capacity === null ? "" : String(event.capacity),
        audience,
        audienceMembers: audienceMembers.map((m) => ({
          id: m.id,
          name: m.nameRomaji ?? m.nameKanji ?? "—",
          kanji: m.nameRomaji ? m.nameKanji : null,
        })),
      },
    },
  };
}

function idForm(id: string, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("id", id);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

/** DELETE /admin/events/:id — deleteEventAction (the editor's 削除). */
export async function adminDeleteEvent(rawId: string): Promise<{ ok: true }> {
  await eventsAdmin();
  const id = IdParam.parse(rawId);
  await deleteEventAction(idForm(id));
  return { ok: true };
}

/** POST /admin/events/:id/approve — approveEventAction. */
export async function adminApproveEvent(
  rawId: string,
): Promise<{ ok: true; approved: boolean }> {
  await eventsAdmin();
  const id = IdParam.parse(rawId);
  const next = await approveEventAction(idForm(id));
  return { ok: true, approved: String(next).includes("approved=1") };
}

export const RsvpClosedBody = z.object({ close: z.boolean() });

/** POST /admin/events/:id/rsvp-closed — setEventRsvpClosedAction. */
export async function adminSetRsvpClosed(
  rawId: string,
  body: z.infer<typeof RsvpClosedBody>,
): Promise<{ ok: true }> {
  await eventsAdmin();
  const id = IdParam.parse(rawId);
  await setEventRsvpClosedAction(idForm(id, { close: body.close ? "1" : "0" }));
  return { ok: true };
}

export const StaffBody = z.object({ userId: IdParam, on: z.boolean() });

/** GET /admin/events/:id/staff?q= — searchAudienceMembersAction. */
export async function adminStaffSearch(
  q: string,
): Promise<AdminStaffCandidate[]> {
  await eventsAdmin();
  return searchAudienceMembersAction(q);
}

/** POST /admin/events/:id/staff — setEventStaffAction. */
export async function adminSetStaff(
  rawId: string,
  body: z.infer<typeof StaffBody>,
): Promise<{ ok: true }> {
  await eventsAdmin();
  const id = IdParam.parse(rawId);
  const { ok } = await setEventStaffAction(id, body.userId, body.on);
  if (!ok) throw new AuthError("forbidden");
  return { ok: true };
}

// ---- exports (the website's /api/admin/events/[id]/{csv,xlsx}) ----
// Same checks as those routes: an ACTIVE member (mobileRoute) who is an
// admin or the event's author.

/** "YYYY-MM-DD HH:mm" in JST. */
function jst(d: Date): string {
  return new Date(d.getTime() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

const FILE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

/** Attendee list as CSV for Excel (UTF-8 with BOM), admins and the author (§10.3). */
export async function adminEventCsv(
  user: CurrentUser,
  rawId: string,
): Promise<Response> {
  if (rawId.length > 64) throw notFound();
  const event = await db.event.findUnique({
    where: { id: rawId },
    select: {
      id: true,
      createdById: true,
      startsAt: true,
      rsvps: {
        orderBy: [{ answer: "asc" }, { updatedAt: "asc" }],
        select: {
          answer: true,
          guests: true,
          updatedAt: true,
          userId: true,
          user: {
            select: { nameRomaji: true, nameKanji: true, primaryEmail: true },
          },
        },
      },
      checkIns: { select: { userId: true, checkedInAt: true } },
    },
  });
  if (!event) throw notFound();
  // Admins, or the author of the event (teacher / 同窓会委員 / 学年代表).
  if (!user.isAdmin && event.createdById !== user.id)
    throw new AuthError("forbidden");

  const checkedIn = new Map(
    event.checkIns.map((c) => [c.userId, c.checkedInAt]),
  );
  // Header stays in English: stable column names for spreadsheets/scripts.
  const rows: (string | number | null)[][] = [
    [
      "name_romaji",
      "name_kanji",
      "email",
      "answer",
      "guests",
      "updated_jst",
      "checked_in_jst",
    ],
    ...event.rsvps.map((r) => {
      const at = checkedIn.get(r.userId);
      return [
        r.user.nameRomaji,
        r.user.nameKanji,
        r.user.primaryEmail,
        r.answer,
        r.guests,
        jst(r.updatedAt),
        at ? jst(at) : null,
      ];
    }),
  ];

  // Export of member PII is recorded like other admin actions.
  await audit(
    user.id,
    "event.csv_export",
    { type: "Event", id: event.id },
    { rows: event.rsvps.length },
  );

  const date = jst(event.startsAt).slice(0, 10);
  return new Response(toCsv(rows), {
    headers: {
      ...FILE_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="event-${date}-${event.id}.csv"`,
    },
  });
}

/** Event detail and attendees as an Excel workbook, admins and the author. */
export async function adminEventXlsx(
  user: CurrentUser,
  rawId: string,
  lang: string | null,
): Promise<Response> {
  if (rawId.length > 64) throw notFound();
  // Admins, or the author of the event (teacher / 同窓会委員 / 学年代表).
  if (!user.isAdmin) {
    const event = await db.event.findUnique({
      where: { id: rawId },
      select: { createdById: true },
    });
    if (event?.createdById !== user.id) throw new AuthError("forbidden");
  }
  const locale =
    lang === "en" || lang === "ja" ? lang : user.locale === "en" ? "en" : "ja";

  const book = await eventWorkbook(rawId, locale);
  if (!book) throw notFound();

  // Export of member PII is recorded like other admin actions.
  await audit(
    user.id,
    "event.xlsx_export",
    { type: "Event", id: rawId },
    { rows: book.rows },
  );

  const date = new Date(book.startsAt.getTime() + 9 * 3600_000)
    .toISOString()
    .slice(0, 10);
  return new Response(new Uint8Array(book.buffer), {
    headers: {
      ...FILE_HEADERS,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="event-${date}-${rawId}.xlsx"`,
    },
  });
}
