/**
 * Admin mode → 一斉通知 (the website's /app/admin/notify): send a
 * notification (Broadcast), the sender's history with read counts, and one
 * sent message with who has read it. Senders: admins, teacher managers and
 * student leaders (their own class). Pure types (see core.ts).
 *
 * While the website's MESSAGES_ENABLED switch is off, the pages answer 404
 * (`not_found`), as on the website.
 */

/** ISO 8601 timestamp. */
type IsoDate = string;

/** AudienceKey values (roles.json audience.*). */
export type BroadcastAudienceKey =
  | "TEACHER"
  | "CURRENT_STUDENT"
  | "CURRENT_PARENT"
  | "GRADUATE"
  | "LEFT_STUDENT"
  | "FORMER_PARENT";

/** Who a message went to: a 学年 (label), some audiences, or everyone. */
export type BroadcastAudienceText =
  | { kind: "cohort"; label: string | null }
  | { kind: "audiences"; keys: BroadcastAudienceKey[] }
  | { kind: "all" };

export type BroadcastCohort = { id: string; label: string };

export type BroadcastHistoryItem = {
  id: string;
  title: string;
  createdAt: IsoDate;
  archived: boolean;
  edited: boolean;
  audience: BroadcastAudienceText;
  /** display name; set in the all-senders view */
  sender: string | null;
  recipientCount: number;
  lineCount: number;
  emailCount: number;
  /** read receipts (null for old messages without them) */
  receipts: { read: number; total: number } | null;
};

// ---- GET /admin/notify?all=1 ----

export type AdminNotifyPage = {
  /** admin or teacher manager: any audience; else the leader's own 学年 */
  canAny: boolean;
  /** admins may switch the history to every sender's messages */
  isAdmin: boolean;
  /** the all-senders history is shown */
  showAll: boolean;
  /** 学年 the sender may target (all for canAny) */
  cohorts: BroadcastCohort[];
  /** the audiences offered for "ROLES" */
  audienceKeys: BroadcastAudienceKey[];
  /** newest first, up to 30 */
  history: BroadcastHistoryItem[];
};

// ---- POST /admin/notify ----

export type BroadcastRequest = {
  /** "preview" checks and counts; "send" delivers */
  intent: "preview" | "send";
  audience: "ALL" | "ROLES" | "COHORT";
  roles: BroadcastAudienceKey[];
  cohortId: string;
  title: string;
  body: string;
};

export type BroadcastPreview = {
  recipients: number;
  line: number;
  email: number;
};

/**
 * The website's form state: `message` / `fieldErrors` values are keys in
 * the "broadcast" namespace (fieldErrors under broadcast.fieldErrors).
 */
export type BroadcastResult = {
  step: "compose" | "confirm" | "sent";
  message?: string;
  fieldErrors?: Partial<
    Record<"title" | "body" | "audience" | "cohortId", string>
  >;
  preview?: BroadcastPreview;
};

// ---- GET /admin/notify/[id] (its sender or an admin) ----

export type BroadcastReceipt = {
  userId: string;
  name: string;
  /** read (or opened) time */
  at: IsoDate | null;
};

export type NotificationOpenRow = BroadcastReceipt & {
  channels: ("LINE" | "EMAIL" | "PUSH")[];
};

/** 「通知の開封」 (notifications.receipts); null until one was sent. */
export type NotificationOpens = {
  opened: NotificationOpenRow[];
  unopened: NotificationOpenRow[];
} | null;

export type AdminBroadcast = {
  id: string;
  title: string;
  body: string;
  createdAt: IsoDate;
  audience: BroadcastAudienceText;
  senderName: string;
  /** PositionKey the sender sent as (broadcast.positions.*), or null */
  position: string | null;
  archived: boolean;
  edited: boolean;
  receipts: { read: BroadcastReceipt[]; unread: BroadcastReceipt[] };
  opens: NotificationOpens;
};

// ---- PATCH /admin/notify/[id] {title, body} ----

/** The website's ManageMessageState (message: key under "broadcast"). */
export type BroadcastEditResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<"title" | "body", string>>;
};

// ---- POST /admin/notify/[id]/archive {archive} · DELETE /admin/notify/[id] ----

export type BroadcastManageOk = { ok: true };
