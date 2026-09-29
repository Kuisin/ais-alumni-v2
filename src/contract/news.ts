/**
 * ニュース (/api/mobile/v1/news/*) — the website's /app/news list and
 * /app/news/[id] page with its hub (確認 / アンケート / 日程調整 /
 * リアクション / コメント). Pure types (see core.ts for the conventions):
 * dates are ISO 8601 strings, URLs may be site-relative.
 */

/** Content shown in the other language: "(English only)" / "(Japanese only)". */
export type NewsFallback = "ja" | "en" | null;

/** An answer in a poll (YES = chosen) or 日程調整 (○ / △ / ×). */
export type NewsVote = "YES" | "MAYBE" | "NO";

/** One post in lists (the website's NewsCard). */
export type NewsSummary = {
  id: string;
  /** in the member's language, else the other one ("" = untitled) */
  title: string;
  titleFallback: NewsFallback;
  /** plain-text start of the body (≤ 140 chars) */
  excerpt: string | null;
  pinned: boolean;
  publishedAt: string | null;
  /** the role it was sent as (「教職員」…), shown as 「発信：…」 */
  sender: string;
  /** not opened yet (posts from before the member joined never are) */
  unread: boolean;
  /** asks for a confirmation / answer the member hasn't given (open posts) */
  needsAnswer: boolean;
  /** shown only because the member is an admin (view only) */
  adminView: boolean;
};

// ---- GET /news?page=N (N = 1…1000) ----

export type NewsList = {
  page: number;
  /** page size: 10 (NEWS_PAGE_SIZE), pinned posts first */
  posts: NewsSummary[];
  hasNext: boolean;
  /** may post ニュース (「ニュースを作成」 → /news/new) */
  canCreate: boolean;
};

// ---- GET /news/[id] (records the read, except for adminView) ----

export type NewsPollOption = {
  id: string;
  label: string;
  /** 日程調整 candidates */
  startsAt: string | null;
  counts: Record<NewsVote, number>;
  /** the member's answer */
  mine: NewsVote | null;
  /** 日程調整: among the best candidates (most ○, then fewest ×) */
  best: boolean;
  /** 日程調整: everyone's answers (shared, like 調整さん); [] for polls */
  names: { name: string; answer: NewsVote }[];
};

export type NewsPoll = {
  id: string;
  kind: "POLL" | "SCHEDULE";
  question: string;
  /** polls: several choices allowed */
  multiple: boolean;
  /** members who answered */
  voters: number;
  options: NewsPollOption[];
};

export type NewsReaction = { emoji: string; count: number; mine: boolean };

export type NewsComment = {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  /** hidden by an admin (only admins receive hidden comments) */
  hidden: boolean;
  mine: boolean;
};

export type NewsAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  /** bytes */
  size: number;
  /** signed, short-lived (15 min) */
  url: string;
};

export type NewsDetail = {
  id: string;
  /** an admin outside the audience: view only, no read / answers recorded */
  adminView: boolean;
  pinned: boolean;
  publishedAt: string;
  sender: string;
  title: string;
  titleFallback: NewsFallback;
  /** Markdown (the website's subset) */
  body: string;
  bodyFallback: NewsFallback;
  /** signed, short-lived (15 min) */
  cover: string | null;
  deadline: string | null;
  /** answers closed early by the sender */
  closedAt: string | null;
  /** answers can be given / changed now (never for adminView) */
  open: boolean;
  requireConfirm: boolean;
  confirmedAt: string | null;
  confirmCount: number;
  polls: NewsPoll[];
  attachments: NewsAttachment[];
  /** reactions and new comments allowed */
  allowComments: boolean;
  reactions: NewsReaction[];
  comments: NewsComment[];
  /** admins may hide / show and delete any comment */
  isAdmin: boolean;
  maxCommentLength: number;
};

// ---- Hub actions (the website's server actions) → { ok: true } ----
// Errors: `error` is a news.hub.errors key —
//   forbidden (403), invalid (400), closed (409), commentsOff (409);
//   not_found (404) for an unknown comment.

export type NewsHubOk = { ok: true };

/** POST /news/[id]/confirm — 「確認しました」 (on) or take it back (off) */
export type NewsConfirmRequest = { on: boolean };

/**
 * POST /news/[id]/vote — replaces the member's answer. Polls: chosen
 * option ids → "YES"; 日程調整: every option id → YES / MAYBE / NO.
 */
export type NewsVoteRequest = {
  pollId: string;
  choices: Record<string, NewsVote>;
};

/** POST /news/[id]/reactions — toggles the member's reaction */
export type NewsReactionRequest = { emoji: string };

/** POST /news/[id]/comments */
export type NewsCommentRequest = { body: string };

/** DELETE /news/[id]/comments/[commentId] — own comments (admins: any) */

/** POST /news/[id]/comments/[commentId]/hide — admins */
export type NewsHideCommentRequest = { hide: boolean };

// ---- あなた宛ての連絡 (Broadcast messages; only while me.features.messages) ----
//   GET /news/messages?page=N       → MessageList
//   GET /news/messages/:id          → MessageDetail (records the read)
// errors: not_found (404) — also while messages are switched off

export type MessageSummary = {
  id: string;
  title: string;
  /** 「名前（学年代表）」 or 「AIS同窓会委員会」, in the member's language */
  sender: string;
  sentAt: string;
  edited: boolean;
  unread: boolean;
};

export type MessageList = {
  page: number;
  hasNext: boolean;
  messages: MessageSummary[];
};

export type MessageDetail = {
  id: string;
  title: string;
  /** plain text (line breaks kept) */
  body: string;
  sender: string;
  sentAt: string;
  edited: boolean;
  /** 学年 or audiences (「全員」 when none), in the member's language */
  sentTo: string;
  /** false: the sender or an admin looking at it (news.messages.senderView) */
  isRecipient: boolean;
};
