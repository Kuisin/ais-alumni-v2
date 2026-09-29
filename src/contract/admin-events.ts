/**
 * 管理モード → イベント管理 — the website's /app/admin/events and
 * /app/admin/events/[id] (src/app/[locale]/app/admin/events). Pure types;
 * see core.ts for the conventions (ISO dates, additive changes only).
 *
 * Everything needs admin mode (requireStaff) and a ニュース/イベント author
 * (requireNewsAuthor), as on the website; errors: forbidden (403).
 *
 *   GET    /admin/events                          → AdminEventList
 *   GET    /admin/events/:id                      → AdminEventDetail
 *   DELETE /admin/events/:id                      → AdminEventDone
 *   POST   /admin/events/:id/approve              → AdminEventApproved
 *   POST   /admin/events/:id/rsvp-closed  { close } → AdminEventDone
 *   GET    /admin/events/:id/staff?q=             → AdminStaffCandidate[]
 *   POST   /admin/events/:id/staff  { userId, on } → AdminEventDone
 *   GET    /admin/events/:id/csv                  → text/csv (attachment)
 *   GET    /admin/events/:id/xlsx?lang=ja|en      → .xlsx (attachment)
 */

import type { EventFormValues } from "./compose";

/** ISO 8601 timestamp. */
type IsoDate = string;

/** As in events.ts (contracts don't import each other). */
type RsvpAnswer = "GOING" | "MAYBE" | "NOT_GOING";
/** Title in the viewer's language, else the other with `fallback` set. */
type EventText = { text: string; fallback: "ja" | "en" | null };

/**
 * Who an event is for, as the website's AudienceSummary badges: 全員, or
 * the groups (adminContent.audience.groups.*), 学年 N (· 保護者含む) and
 * 個別 N人.
 */
export type AdminAudienceSummary = {
  everyone: boolean;
  groups: string[];
  cohorts: number;
  includeParents: boolean;
  users: number;
};

// ---- GET /admin/events ----

/** adminContent.events.status.* (upcoming events only). */
export type AdminEventStatus = "open" | "closed" | "full";

export type AdminEventRow = {
  id: string;
  title: EventText;
  startsAt: IsoDate;
  capacity: number | null;
  /** GOING answers plus their guests */
  going: number;
  status: AdminEventStatus | null;
  /** a 同窓会委員's event waiting for approval */
  awaitingApproval: boolean;
  audience: AdminAudienceSummary;
};

/**
 * Admins see every event; other authors their own, and 同窓会委員 also the
 * 同窓会委員 events they may approve.
 */
export type AdminEventList = {
  isAdmin: boolean;
  upcoming: AdminEventRow[];
  /** newest first, at most `pastLimit` */
  past: AdminEventRow[];
  pastLimit: number;
};

// ---- GET /admin/events/:id ----
// errors: not_found (404) — also for events the member may not open

export type AdminEventFields = {
  titleJa: string | null;
  titleEn: string | null;
  bodyJa: string | null;
  bodyEn: string | null;
  startsAt: IsoDate;
  endsAt: IsoDate | null;
  location: string | null;
  mapUrl: string | null;
  capacity: number | null;
  rsvpDeadline: IsoDate | null;
};

export type AdminApproval = {
  approvedAt: IsoDate | null;
  /** kanji, else romaji name of who approved */
  approvedBy: string | null;
  /** the viewer may approve it now (another 同窓会委員 or an admin) */
  canApprove: boolean;
};

export type AdminRsvpRow = {
  id: string;
  userId: string;
  /** displayName() in the viewer's language */
  name: string;
  answer: RsvpAnswer;
  guests: number;
  updatedAt: IsoDate;
  checkedInAt: IsoDate | null;
};

export type AdminStaffMember = {
  id: string;
  /** romaji, else kanji */
  name: string;
  /** kanji when `name` is romaji */
  kanji: string | null;
};

export type AdminStaffCandidate = AdminStaffMember;

export type AdminReceipt = {
  userId: string;
  name: string;
  /** "LINE" | "EMAIL" | "PUSH" … (notifications.receipts.channel.*) */
  channels: string[];
  openedAt: IsoDate | null;
};

export type AdminEventManage = {
  /** headcount(): GOING answers plus their guests */
  headcount: number;
  checkedIn: number;
  summary: Record<RsvpAnswer, { count: number; guests: number }>;
  /** GOING, MAYBE, NOT_GOING; newest change first within each */
  rsvps: AdminRsvpRow[];
  /** 出欠の受付: closed early at, and the effective deadline (rsvpClosesAt) */
  rsvpClosedAt: IsoDate | null;
  rsvpDeadline: IsoDate | null;
  /** 「通知の開封」 (reminders); null until a notification was sent */
  opens: { opened: AdminReceipt[]; unopened: AdminReceipt[] } | null;
  staff: AdminStaffMember[];
  /** the event as the edit form's values (EventForm, POST /compose/events) */
  values: EventFormValues;
};

export type AdminEventDetail = {
  id: string;
  /** localized title for the header */
  title: string;
  startsAt: IsoDate;
  event: AdminEventFields;
  audience: AdminAudienceSummary;
  /** set for events that need a 同窓会委員's approval */
  approval: AdminApproval | null;
  /**
   * The viewer may edit this event (admins, its author). False: another
   * 同窓会委員 checking it before approving — view only, no `manage`.
   */
  canEdit: boolean;
  manage: AdminEventManage | null;
};

// ---- mutations ----

export type AdminEventDone = { ok: true };
export type AdminEventApproved = { ok: true; approved: boolean };
export type AdminRsvpClosedRequest = { close: boolean };
export type AdminStaffRequest = { userId: string; on: boolean };
