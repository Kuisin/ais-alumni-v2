/**
 * App notifications: this device's push registration, the notification
 * list (お知らせ) and chat notification levels. Pure types (see core.ts).
 */

// ---- /push — this device ----

/** GET /push */
export type PushState = {
  /** the server writes pushes to its local outbox (development): a build
   *  without an EAS project may register a development token */
  devTokens: boolean;
  /** this device's registration (null = not registered) */
  device: {
    enabled: boolean;
    platform: string | null;
    /** Expo reported the token dead; register again */
    failed: boolean;
    since: string;
  } | null;
  /** other signed-in devices of the member that get notifications */
  otherDevices: number;
};

/**
 * PUT /push — register or update this device (after the OS allowed
 * notifications). `enabled: false` keeps the token but sends nothing.
 * errors: invalid_token (400), push_unavailable (400: a development token
 * on a server that can't deliver it)
 */
export type PushRegisterRequest = {
  /** ExponentPushToken[…] */
  token: string;
  platform: "ios" | "android";
  enabled?: boolean;
};

/** DELETE /push — this device stops getting notifications → PushState */

/** POST /push/test — a test notification to this device.
 *  errors: not_registered (409), too_soon (429), send_failed (502) */
export type PushTestResult = { ok: true };

/** What a push carries in `data` (src/lib/push/message.ts). */
export type PushData = {
  v: 1;
  kind: string;
  category: string;
  /** app page without the locale, e.g. /app/news/<id> */
  path: string | null;
  /** notification token for read receipts (POST /notifications/open) */
  receipt?: string;
  /** what it's about (chat id, follow request id …) */
  refId?: string;
};

// ---- /notifications — the notification list ----

export type InboxItem = {
  /** receipt id */
  id: string;
  kind: string;
  /** account | news | events | social | family | profile | admin */
  category: string;
  emoji: string;
  title: string;
  body: string;
  /** app page without the locale; null = nothing to open */
  path: string | null;
  sentAt: string;
  /** seen in this list or opened */
  read: boolean;
  /** LINE | EMAIL | PUSH */
  channels: string[];
};

/** GET /notifications?cursor= — newest first; chats aren't listed (the
 *  chat tab has its own unread marks). */
export type InboxPage = {
  items: InboxItem[];
  nextCursor: string | null;
  /** unread in the last 14 days (Me.badges.inbox) */
  unread: number;
};

/** POST /notifications/read — mark as seen (no ids = all) → { unread } */
export type InboxReadRequest = { ids?: string[] };
export type InboxReadResult = { unread: number };

/** POST /notifications/open — a notification was opened (tap on a push:
 *  `token` = PushData.receipt; in the list: `id`) → where to go.
 *  errors: not_found (404) */
export type InboxOpenRequest = { token?: string; id?: string };
export type InboxOpenResult = { path: string | null };

// ---- chat notification levels ----

/**
 * Group chats (PUT /chat/:id/notifications { level }):
 *  - all: a push for every message;
 *  - mentions: pushes for mentions of you, and the daily summary (default);
 *  - off: pushes for mentions only; no daily summary.
 * 1:1 talks always notify (their daily-summary switch is PUT /chat/:id/mute).
 * errors: direct (400: not for 1:1 talks), not_found (404)
 */
export type ChatNotifyLevel = "all" | "mentions" | "off";
export type ChatNotifyRequest = { level: ChatNotifyLevel };
export type ChatNotifyResult = { level: ChatNotifyLevel };
