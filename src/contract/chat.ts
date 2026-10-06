/**
 * チャット — the website's /app/chat, /app/chat/[id], /app/chat/[id]/info
 * and /app/chat/new (src/app/[locale]/app/(member)/chat). Pure types; see
 * core.ts for the conventions (ISO dates, additive changes only).
 *
 *   GET    /chat                                → ChatList
 *   GET    /chat/direct                         → DirectCandidates
 *   POST   /chat/direct         StartDirectRequest → StartDirectResult
 *   GET    /chat/:id                            → ChatRoom
 *   GET    /chat/:id/messages?before=… | after=… → ChatMessagesPage
 *   POST   /chat/:id/messages   SendMessageRequest → SendMessageResult
 *   DELETE /chat/:id/messages/:messageId        → OkResult
 *   GET    /chat/:id/messages/:messageId/reactions → ChatReactionsResult
 *   POST   /chat/:id/messages/:messageId/reactions ToggleReactionRequest
 *                                               → ChatReactionsResult
 *   GET    /chat/:id/read                       → ChatReads
 *   POST   /chat/:id/read                       → OkResult (marks read)
 *   PUT    /chat/:id/mute       MuteRequest     → MuteResult
 *   GET    /chat/:id/info                       → ChatInfo
 *   POST   /chat/:id/report     ReportRequest   → ReportResult
 *
 * A talk the member can't open (not theirs; admins may open group chats,
 * never others' 1:1 talks) is 404 `not_found` — except POST /messages,
 * which answers 403 `forbidden` as the website's action does.
 *
 * Live updates: subscribe to ChatRoom.topic (signal-only Supabase
 * Broadcast, as on the website): "message" { id } → load
 * /messages?after=<latest>; "delete" { id } → show it as deleted; "read" {}
 * → reload /read; "reaction" { id } → reload that message's reactions
 * (GET …/reactions). Without Realtime, poll both every 5 s.
 */

/** ISO 8601 timestamp. */
type IsoDate = string;

export type ChatKind =
  | "TEACHERS"
  | "CURRENT_STUDENTS"
  | "FORMER_STUDENTS"
  | "CURRENT_PARENTS"
  | "FORMER_PARENTS"
  | "COHORT"
  | "COHORT_PARENTS"
  | "ADULTS"
  | "DIRECT"
  | "CLASS_REPS"
  | "GRADUATES"
  | "GRADUATES_ADULTS"
  | "ALUMNI_COMMITTEE";

export type OkResult = { ok: true };

// ---- GET /chat ----

export type ChatListRow = {
  id: string;
  /** a 1:1 talk (友だち) */
  direct: boolean;
  /** false = an admin looking into a group they're not in (その他のグループ) */
  joined: boolean;
  /** the other person (1:1) or the group's name, in the member's language */
  name: string;
  /** 1:1: the other person's photo (visibility-checked); null for groups */
  avatar: string | null;
  memberCount: number;
  /**
   * The last message ("あなた: …" / "Name: …"; a 1:1 partner's own message
   * without the name), or 「メンバー N人」 while there is none.
   */
  preview: string;
  lastAt: IsoDate | null;
  /** unread messages (not the member's own) */
  unread: number;
  /** an unread message mentions the member (or @全員): show chat.mentionedYou */
  mentioned: boolean;
};

export type ChatList = {
  /** newest activity first, then the website's group order */
  rows: ChatListRow[];
  /** the member's type allows 1:1 talks: show 「新しいトーク」 (/chat/new) */
  canStartDirect: boolean;
};

// ---- GET /chat/direct (404 while 1:1 talks are switched off) ----

export type DirectCandidate = {
  id: string;
  /** displayName() */
  name: string;
  /** the kanji name when `name` is the romaji one */
  kanji: string | null;
  avatar: string;
};

export type DirectCandidates = {
  /** false: the member's type has no 1:1 talks (chat.new.restricted) */
  available: boolean;
  /** mutual followers they may talk to, by name */
  people: DirectCandidate[];
};

// ---- POST /chat/direct ----

export type StartDirectRequest = { userId: string };
/** Opens (or creates) the 1:1 talk: go to /chat/:groupId. */
export type StartDirectResult = { groupId: string };
/**
 * Error codes (`{ error }`), texts in chat.new.errors.<code>:
 * disabled (403), self (400), notFound (404), restricted (403),
 * notFriends (403), blocked (403), forbidden (403); `invalid` (400) for a
 * malformed body.
 */
export type StartDirectError =
  | "disabled"
  | "self"
  | "notFound"
  | "restricted"
  | "notFriends"
  | "blocked"
  | "forbidden";

// ---- GET /chat/:id ----

export type ChatMessage = {
  id: string;
  userId: string;
  name: string;
  /** photo or default icon (visibility-checked); null = default icon */
  avatar: string | null;
  /** 第N期 of the sender (students / graduates) */
  cohort: number | null;
  /** the sender is a 学年代表 */
  rep: boolean;
  /** empty when deleted */
  body: string;
  createdAt: IsoDate;
  /** show chat.room.deleted instead of the text */
  deleted: boolean;
  /** members mentioned with "@name" (highlight "@" + their name) */
  mentionUserIds: string[];
  /** "@全員" / "@all" */
  mentionAll: boolean;
  /**
   * Emoji reactions, by when each emoji was first used. Missing (older
   * servers) or empty = none; always empty for deleted messages.
   */
  reactions?: ChatReactionSummary[];
};

export type ChatReactionSummary = {
  /** one emoji (a single grapheme cluster) */
  emoji: string;
  count: number;
  /** the member reacted with it (tap again to remove) */
  mine: boolean;
  /** who reacted (up to 10, earliest first) — the 「リアクションした人」 sheet */
  names: string[];
};

export type ChatRoomMember = {
  id: string;
  name: string;
  avatar: string;
  cohort: number | null;
  rep: boolean;
};

export type ChatRoom = {
  id: string;
  kind: ChatKind;
  /** realtime channel of the talk (see the top of this file) */
  topic: string;
  /** the other person (1:1) or the group's name */
  title: string;
  direct: boolean;
  /** false = an admin looking into a group: may delete, can't post */
  member: boolean;
  /** may delete anyone's message (admins); others only their own */
  moderator: boolean;
  memberCount: number;
  /** everyone in the talk (for @mentions and names), by name */
  members: ChatRoomMember[];
  /** 1:1: the other person (第N期 / 学年代表 next to the title) */
  partner: ChatRoomMember | null;
  /** the latest page, oldest first */
  messages: ChatMessage[];
  /** older messages exist: GET /messages?before=<oldest createdAt> */
  hasOlder: boolean;
  /** when each other member last read the talk (既読 marks) */
  reads: IsoDate[];
  /** the same, with who (tapping 既読 lists them); absent on older servers */
  readBy?: ChatReadBy[];
  /** when the member last read it before opening (the 「ここから未読」 line) */
  lastReadAt: IsoDate | null;
  /** no daily digest for this talk */
  muted: boolean;
  /**
   * Group chats' app notifications (contract/notifications.ts
   * ChatNotifyLevel): every message, mentions (+ daily summary), or off.
   */
  notifyLevel: "all" | "mentions" | "off";
  /**
   * A 1:1 talk that can't go on: a block (chat.room.blockedNotice) or the
   * member types' rules (chat.room.restrictedNotice). Null = it can.
   */
  stopped: "blocked" | "restricted" | null;
};

// ---- GET /chat/:id/messages ----
// ?before=<ISO>: the 50 before it (older, for scrolling up)
// ?after=<ISO>:  up to 200 after it (new ones; deleted ones included)

export type ChatMessagesPage = {
  /** oldest first */
  messages: ChatMessage[];
  /** before: there are older ones; after: more new ones — ask again */
  hasMore: boolean;
};

// ---- POST /chat/:id/messages ----

/** Mentions are found in the text ("@name", "@全員"), as on the website. */
export type SendMessageRequest = { body: string };
export type SendMessageResult = { message: ChatMessage };
/** Error codes, texts in chat.room.errors.<code>. */
export type SendMessageError =
  /** 403: not a member, or a stopped 1:1 talk */
  | "forbidden"
  /** 400: empty or over 2000 characters */
  | "invalid"
  /** 429: over 20 messages a minute */
  | "tooFast";

// ---- DELETE /chat/:id/messages/:messageId ----
// Authors delete their own messages, admins (moderator) anyone's.
// errors: not_found (404), forbidden (403)

// ---- GET / POST /chat/:id/messages/:messageId/reactions ----
// Anyone who can open the talk may react (not in a stopped 1:1 talk).
// POST toggles the member's reaction with that emoji.

export type ToggleReactionRequest = { emoji: string };
export type ChatReactionsResult = { reactions: ChatReactionSummary[] };
/**
 * Error codes: invalid (400: not a single emoji), too_many (400: already 20
 * different emoji on the message), deleted (400: the message was deleted),
 * forbidden (403), not_found (404), unavailable (503: reactions aren't
 * available on this server yet).
 */
export type ToggleReactionError =
  | "invalid"
  | "too_many"
  | "deleted"
  | "forbidden"
  | "not_found"
  | "unavailable";

// ---- GET /chat/:id/read ----

/** A member (ChatRoom.members) and when they last read the talk. */
export type ChatReadBy = { userId: string; at: IsoDate };

export type ChatReads = { reads: IsoDate[]; readBy?: ChatReadBy[] };

// ---- PUT /chat/:id/mute ----

/** muted = no daily email digest (chat.room.digest is the opposite) */
export type MuteRequest = { muted: boolean };
export type MuteResult = { muted: boolean };
// errors: forbidden (403) — only members of the talk

// ---- GET /chat/:id/info ----

export type ChatInfoMember = {
  id: string;
  name: string;
  /** 漢字（フリガナ） */
  otherNames: string | null;
  avatar: string;
  cohort: number | null;
  rep: boolean;
  /** the signed-in member (show chat.you) */
  self: boolean;
  /** may open their profile (/app/members/:id) */
  linked: boolean;
};

export type ChatInfo = {
  id: string;
  kind: ChatKind;
  title: string;
  direct: boolean;
  /** 「1対1のトーク」 or what the group is, in the member's language */
  hint: string | null;
  memberCount: number;
  /** 1:1: the other person (their photo on top) */
  partner: ChatInfoMember | null;
  /** the member first, then by name */
  members: ChatInfoMember[];
  /** a member of the talk (not an admin looking in): may mute and report */
  member: boolean;
  muted: boolean;
  /** see ChatRoom.notifyLevel */
  notifyLevel: "all" | "mentions" | "off";
};

// ---- POST /chat/:id/report ----

export type ChatReportReason =
  | "HARASSMENT"
  | "SPAM"
  | "INAPPROPRIATE"
  | "IMPERSONATION"
  | "PRIVACY"
  | "OTHER";

export type ReportRequest = {
  /** someone in the talk, or null for the talk as a whole */
  userId: string | null;
  reason: ChatReportReason;
  /** 5–2000 characters */
  detail: string;
};
/** chat.report.sent with { ref } */
export type ReportResult = { ref: string };
/** Error codes, texts in chat.report.errors.<code>. */
export type ReportError =
  /** 403: not a member of the talk, or the person isn't in it */
  | "forbidden"
  /** 400 */
  | "reason"
  /** 400 */
  | "detail"
  /** 429: 5 reports an hour */
  | "rateLimited";
