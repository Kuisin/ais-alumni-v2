/**
 * イベント — the website's /app/events and /app/events/[id]
 * (src/app/[locale]/app/(member)/events). Pure types; see core.ts for the
 * conventions (ISO dates, additive changes only).
 *
 *   GET  /events?tab=upcoming|past&page=1   → EventList
 *   GET  /events/:id                        → EventDetail
 *   POST /events/:id/rsvp  RsvpRequest      → RsvpResult
 */

/** ISO 8601 timestamp. */
type IsoDate = string;

export type RsvpAnswer = "GOING" | "MAYBE" | "NOT_GOING";

export type EventTab = "upcoming" | "past";

/**
 * Admin-authored text in the member's language, else the other language
 * with `fallback` set (show 「（英語のみ）」 / "(Japanese only)").
 * An empty title means untitled (events.untitled).
 */
export type EventText = { text: string; fallback: "ja" | "en" | null };

// ---- GET /events?tab=upcoming|past&page=N ----

/**
 * "upcoming" (default) includes events in progress, soonest first; "past"
 * is newest first. Only approved events the member is in the audience for.
 */
export type EventList = {
  tab: EventTab;
  /** 1-based, 20 per page */
  page: number;
  hasNext: boolean;
  events: EventListItem[];
  /** may create events (admins, teachers, 同窓会委員, 学年代表): website /app/events/new */
  canCreate: boolean;
};

export type EventListItem = {
  id: string;
  title: EventText;
  startsAt: IsoDate;
  location: string | null;
  /** 「発信」: the role it comes from (「教職員」…), in the member's language */
  sender: string;
  /** the member's own RSVP */
  myAnswer: RsvpAnswer | null;
};

// ---- GET /events/:id ----
// errors: not_found (404) — also for events the member isn't invited to

export type EventDetail = {
  id: string;
  title: EventText;
  /** Markdown (the website's small subset) */
  body: EventText;
  startsAt: IsoDate;
  endsAt: IsoDate | null;
  location: string | null;
  /** the organiser's map link, else a Google Maps search for the location */
  mapUrl: string | null;
  /** 主催: the role it comes from, in the member's language */
  sender: string;
  /** null = no limit */
  capacity: number | null;
  /** people going (GOING answers plus their guests) */
  going: number;
  /** spots left (never negative); null = no limit */
  remaining: number | null;
  rsvp: EventRsvp;
  /** the entry ticket, once the member answered 参加 / 未定 (or was checked in) */
  ticket: EventTicket | null;
  /** staff (admins, the author, assigned staff): the website's check-in screen */
  checkInPath: string | null;
};

export type EventRsvp = {
  /** answers accepted now */
  open: boolean;
  /** the RSVP deadline, or the start when there is none */
  closesAt: IsoDate;
  /** closed early by the organiser (else: past the deadline) */
  closedByOrganizer: boolean;
  /** no spots left for a new 参加 (未定 / 不参加 still possible) */
  full: boolean;
  /** time left before the deadline, while open */
  left: { unit: "days" | "hours"; count: number } | null;
  /** guests allowed per answer (not counting the member) */
  maxGuests: number;
  mine: { answer: RsvpAnswer; guests: number } | null;
};

export type EventTicket = {
  /** QR code (SVG markup) holding the check-in link staff scan */
  qrSvg: string;
  /** the member's name as on the ticket (romaji, else kanji) */
  name: string;
  /** kanji name under the romaji one, when both exist */
  kanji: string | null;
  checkedInAt: IsoDate | null;
};

// ---- POST /events/:id/rsvp ----

/** `guests` only counts for GOING / MAYBE (0 – maxGuests). */
export type RsvpRequest = { answer: RsvpAnswer; guests: number };

/** The saved RSVP, with the event as it is now. */
export type RsvpResult = { ok: true; event: EventDetail };
// errors (the website's events.rsvp.errors.*):
//   closed, capacity (409) · guests, invalid (400) · not_found (404)
//   · server_error (500)
