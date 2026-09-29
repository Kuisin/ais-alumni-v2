import type {
  EventDetail,
  EventList,
  EventRsvp,
  EventTab,
  EventTicket,
  RsvpResult,
} from "@contract/events";
import { toString as qrToString } from "qrcode";
import { z } from "zod";
import { type RsvpState, rsvpAction } from "@/server/app/actions/events";
import type { Prisma } from "@/server/generated/prisma/client";
import { RsvpAnswer } from "@/server/generated/prisma/enums";
import { awaitingApproval, eventApprovedWhere } from "@/server/lib/approval";
import { getNewsScope } from "@/server/lib/broadcasts";
import { db } from "@/server/lib/db";
import { canCheckIn } from "@/server/lib/event-staff";
import {
  checkInPath,
  ticketToken,
  ticketUrl,
} from "@/server/lib/event-tickets";
import {
  isRsvpOpen,
  MAX_GUESTS,
  mapLink,
  remainingSpots,
  rsvpClosesAt,
} from "@/server/lib/events";
import { localized } from "@/server/lib/format";
import {
  ApiError,
  forbidden,
  IdParam,
  invalid,
  type Locale,
  notFound,
} from "@/server/lib/mobile/http";
import { iso } from "@/server/lib/mobile/present";
import { EVENTS_PAGE_SIZE } from "@/server/lib/news";
import { filterByAudience, inAudience } from "@/server/lib/news-visibility";
import { senderLabel, senderLabels } from "@/server/lib/sender";
import type { CurrentUser } from "@/server/lib/session";

/**
 * イベント for the native app: the same queries, visibility rules and RSVP
 * action as the website's /app/events pages
 * (src/app/[locale]/app/(member)/events). Audience, approval, check-in staff
 * and RSVP rules all come from the shared lib code.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * ?tab= and ?page= as the website reads them: anything but "past" is
 * upcoming; the page is 1 – 1000, else 1 (parsePage in
 * src/components/news/pager.tsx, a component module the API doesn't load).
 */
export const EventListQuery = z.object({
  tab: z
    .string()
    .optional()
    .transform((v): EventTab => (v === "past" ? "past" : "upcoming")),
  page: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
    }),
});

/** "Upcoming" includes events in progress (started, not yet ended). */
export function eventTimeWhere(
  tab: EventTab,
  now: Date,
): Prisma.EventWhereInput {
  return tab === "past"
    ? {
        startsAt: { lt: now },
        OR: [{ endsAt: null }, { endsAt: { lt: now } }],
      }
    : { OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] };
}

/** "13 days left" / "5 hours left" next to the RSVP deadline, while open. */
export function deadlineLeft(
  closesAt: Date,
  open: boolean,
  now: number = Date.now(),
): EventRsvp["left"] {
  const msLeft = closesAt.getTime() - now;
  if (!open || msLeft <= 0) return null;
  return msLeft >= DAY_MS
    ? { unit: "days", count: Math.floor(msLeft / DAY_MS) }
    : { unit: "hours", count: Math.max(1, Math.ceil(msLeft / HOUR_MS)) };
}

/** GET /events — one page of the website's list. */
export async function listEvents(
  user: CurrentUser,
  locale: Locale,
  tab: EventTab,
  page: number,
): Promise<EventList> {
  // Audience (same conditions as ニュース) is matched in code: 学年 and
  // individually chosen members can't be expressed in SQL.
  const all = await db.event.findMany({
    // A 同窓会委員's event shows once approved.
    where: { ...eventTimeWhere(tab, new Date()), AND: [eventApprovedWhere] },
    orderBy: { startsAt: tab === "past" ? "desc" : "asc" },
    take: 1000,
    select: {
      audience: true,
      targetAudiences: true,
      targetRoles: true,
      id: true,
      titleJa: true,
      titleEn: true,
      startsAt: true,
      location: true,
      senderRole: true,
      rsvps: { where: { userId: user.id }, select: { answer: true } },
    },
  });
  const rows = (await filterByAudience(user, all)).slice(
    (page - 1) * EVENTS_PAGE_SIZE,
    page * EVENTS_PAGE_SIZE + 1,
  );
  const events = rows.slice(0, EVENTS_PAGE_SIZE);
  const [senders, scope] = await Promise.all([
    senderLabels(events, locale),
    getNewsScope(user),
  ]);
  return {
    tab,
    page,
    hasNext: rows.length > EVENTS_PAGE_SIZE,
    // Same authors as ニュース (admins, teachers, 同窓会委員, 学年代表).
    canCreate: scope !== null,
    events: events.map((e) => ({
      id: e.id,
      title: localized(e.titleJa, e.titleEn, locale),
      startsAt: e.startsAt.toISOString(),
      location: e.location,
      sender: senders.get(e.id) ?? "",
      myAnswer: e.rsvps[0]?.answer ?? null,
    })),
  };
}

/** The event if the member may see it (approved, in its audience), else 404. */
async function visibleEvent(user: CurrentUser, id: string) {
  if (!IdParam.safeParse(id).success) throw notFound();
  const event = await db.event.findUnique({ where: { id } });
  if (!event || awaitingApproval(event) || !(await inAudience(user, event)))
    throw notFound();
  return event;
}

/** The member's QR ticket (src/components/events/ticket-card.tsx). */
async function ticketFor(
  eventId: string,
  user: CurrentUser,
  checkedInAt: Date | null,
): Promise<EventTicket> {
  const qrSvg = await qrToString(
    ticketUrl(eventId, ticketToken(eventId, user.id)),
    { type: "svg", margin: 1, errorCorrectionLevel: "M" },
  );
  return {
    qrSvg,
    name: user.nameRomaji ?? user.nameKanji ?? "",
    kanji: user.nameRomaji && user.nameKanji ? user.nameKanji : null,
    checkedInAt: iso(checkedInAt),
  };
}

/** GET /events/:id — everything the website's detail page shows. */
export async function eventDetail(
  user: CurrentUser,
  locale: Locale,
  id: string,
): Promise<EventDetail> {
  const event = await visibleEvent(user, id);
  const [going, mine, checkIn, staff, sender] = await Promise.all([
    db.rsvp.aggregate({
      where: { eventId: id, answer: RsvpAnswer.GOING },
      _count: { _all: true },
      _sum: { guests: true },
    }),
    db.rsvp.findUnique({
      where: { eventId_userId: { eventId: id, userId: user.id } },
      select: { answer: true, guests: true },
    }),
    db.eventCheckIn.findUnique({
      where: { eventId_userId: { eventId: id, userId: user.id } },
      select: { checkedInAt: true },
    }),
    canCheckIn(user, id),
    senderLabel(event, locale),
  ]);
  const goingTotal = going._count._all + (going._sum.guests ?? 0);
  const remaining = remainingSpots(event.capacity, goingTotal);
  const open = isRsvpOpen(event);
  const closesAt = rsvpClosesAt(event);
  const ticket =
    (mine && mine.answer !== RsvpAnswer.NOT_GOING) || checkIn
      ? await ticketFor(event.id, user, checkIn?.checkedInAt ?? null)
      : null;
  return {
    id: event.id,
    title: localized(event.titleJa, event.titleEn, locale),
    body: localized(event.bodyJa, event.bodyEn, locale),
    startsAt: event.startsAt.toISOString(),
    endsAt: iso(event.endsAt),
    location: event.location,
    mapUrl: mapLink(event.mapUrl, event.location),
    sender,
    capacity: event.capacity,
    going: goingTotal,
    remaining,
    rsvp: {
      open,
      closesAt: closesAt.toISOString(),
      closedByOrganizer: Boolean(event.rsvpClosedAt),
      full: remaining === 0 && mine?.answer !== RsvpAnswer.GOING,
      left: deadlineLeft(closesAt, open),
      maxGuests: MAX_GUESTS,
      mine,
    },
    ticket,
    checkInPath: staff ? checkInPath(event.id) : null,
  };
}

export const RsvpBody = z.object({
  answer: z.enum(RsvpAnswer),
  guests: z.number().int().min(0).max(MAX_GUESTS).default(0),
});

/** The RSVP action's refusals as API errors (codes for events.rsvp.errors). */
export function rsvpError(error: NonNullable<RsvpState["error"]>): ApiError {
  switch (error) {
    case "closed":
    case "capacity":
      return new ApiError(409, error);
    case "guests":
      return new ApiError(400, "guests");
    case "validation":
      return invalid();
    case "notFound":
      return notFound();
    case "forbidden":
      return forbidden();
    default:
      return new ApiError(500, "server_error");
  }
}

/** POST /events/:id/rsvp — the website's RSVP form (rsvpAction). */
export async function answerRsvp(
  user: CurrentUser,
  locale: Locale,
  id: string,
  body: z.infer<typeof RsvpBody>,
): Promise<RsvpResult> {
  if (!IdParam.safeParse(id).success) throw notFound();
  const form = new FormData();
  form.set("eventId", id);
  form.set("answer", body.answer);
  form.set("guests", String(body.guests));
  const state = await rsvpAction({}, form);
  if (state.error) throw rsvpError(state.error);
  return { ok: true, event: await eventDetail(user, locale, id) };
}
