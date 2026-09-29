/**
 * ホーム (/api/mobile/v1/home) — the website's /app/dashboard. Pure types
 * (see core.ts for the conventions): dates are ISO 8601 strings; website
 * paths ("/app/…") are opened with the app's hrefFor().
 */

/** Waiting for the member (the dashboard's 「対応が必要な項目」). */
export type HomeTodo = {
  /** follow requests to review (→ /app/follows) */
  followRequests: number;
  /** vouch requests to answer (→ website /app/vouch/[id]) */
  vouches: { id: string; name: string }[];
  /** family links the other side added, to confirm (→ website /app/family) */
  family: { id: string; initiatedBy: "PARENT" | "CHILD"; name: string }[];
};

export type HomeSetupKey =
  | "email"
  | "apply"
  | "approval"
  | "line"
  | "photo"
  | "bio"
  | "history"
  | "follow"
  | "family"
  | "names"
  | "schoolEmail";

/** One task of the 「はじめの設定」 checklist (src/lib/setup.ts). */
export type HomeSetupItem = {
  key: HomeSetupKey;
  done: boolean;
  /** where it's done (website path), null = nothing to open yet */
  href: string | null;
  /** doesn't count towards finishing (「任意」) */
  optional: boolean;
  /** optional, but suggested (「おすすめ」) */
  recommended: boolean;
};

export type HomeSetup = {
  items: HomeSetupItem[];
  /** required tasks done / total */
  done: number;
  total: number;
  /** all required tasks done: the LINE banner is shown instead */
  complete: boolean;
};

/**
 * 「LINEで最新情報を受け取る」 banner. Not linked: link LINE (POST
 * /home/line-link gives the URL to open). Linked but not following: add
 * the Official Account as a friend (addFriendUrl).
 */
export type HomeLineBanner = {
  linked: boolean;
  addFriendUrl: string | null;
};

/** An upcoming event (the dashboard's EventCard). */
export type HomeEvent = {
  id: string;
  /** in the member's language, else the other one ("" = untitled) */
  title: string;
  titleFallback: "ja" | "en" | null;
  startsAt: string;
  location: string | null;
  /** the role it comes from (「教職員」…), shown as 「発信：…」 */
  sender: string;
  /** the member's RSVP */
  myAnswer: "GOING" | "MAYBE" | "NOT_GOING" | null;
};

/** A recent post (the dashboard's NewsCard, without excerpt). */
export type HomeNews = {
  id: string;
  title: string;
  titleFallback: "ja" | "en" | null;
  pinned: boolean;
  publishedAt: string | null;
  sender: string;
  unread: boolean;
  needsAnswer: boolean;
};

// ---- GET /home ----

export type Home = {
  todo: HomeTodo;
  setup: HomeSetup;
  /** only once setup is complete, and only when there's something to offer */
  line: HomeLineBanner | null;
  /** unread messages (only while messages are switched on; else 0) */
  unreadMessages: number;
  /** up to 3 upcoming events the member is in the audience for */
  events: HomeEvent[];
  /** up to 3 latest posts aimed at the member (not admin-only views) */
  news: HomeNews[];
};

// ---- POST /home/line-link → a fresh LINE linking URL (valid 10 min) ----
// Open it in the browser; it ends on the website's 「LINE を連携しました」
// page. errors: line_unavailable (404) when LINE isn't set up.

export type HomeLineLink = { url: string };

// ---- POST /home/line-banner/dismiss → { ok: true } (hidden for 30 days) ----
