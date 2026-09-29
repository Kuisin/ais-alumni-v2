/**
 * Admin mode → ニュース (the website's /app/admin/news and
 * /app/admin/news/[id]): every post (admins) or the author's own (and, for
 * 同窓会委員, the 同窓会委員 posts they may approve), with status, audience
 * and read counts; one post with approval, 公開して通知, 回答の受付,
 * 回答状況, 既読 and 通知の開封, and its editor values (NewsForm, see
 * compose.ts). Pure types (see core.ts).
 *
 *   GET    /admin/news?page=&archived=1  → AdminNewsList
 *   GET    /admin/news/[id]              → AdminNewsDetail
 *   DELETE /admin/news/[id]              → AdminNewsDone
 *   POST   /admin/news/[id]/archive {archive: boolean}  → AdminNewsDone
 *   GET    /admin/news/[id]/notify       → AdminNewsNotifyEstimate
 *   POST   /admin/news/[id]/notify       → AdminNewsDone (publish now + notify)
 *   POST   /admin/news/[id]/approve      → AdminNewsDone
 *   POST   /admin/news/[id]/close {close: boolean}      → AdminNewsDone
 *
 * Authors only (admins, current teachers, 同窓会委員, 学年代表): 403
 * otherwise; a post the member may not open: 404.
 */
import type { AdminAudienceSummary } from "./admin-events";
import type { NewsFormValues } from "./compose";

/** ISO 8601 timestamp. */
type IsoDate = string;

export type AdminNewsStatus = "draft" | "scheduled" | "published";

/** The badges of a post (the website's NewsStatusBadges). */
export type AdminNewsBadges = {
  status: AdminNewsStatus;
  awaitingApproval: boolean;
  notified: boolean;
  pinned: boolean;
};

export type AdminNewsRow = AdminNewsBadges & {
  id: string;
  /** in the member's language, else the other one */
  title: string;
  /** "ja" / "en": the title is in the other language */
  titleFallback: "ja" | "en" | null;
  /** not notified and 通知なし */
  noNotify: boolean;
  publishedAt: IsoDate | null;
  audience: AdminAudienceSummary;
  /** live posts only */
  reads: { read: number; audience: number } | null;
};

export type AdminNewsList = {
  /** admins see every post; others their own */
  isAdmin: boolean;
  archived: boolean;
  archivedCount: number;
  page: number;
  hasNext: boolean;
  posts: AdminNewsRow[];
};

export type AdminReceipt = {
  userId: string;
  name: string;
  at: IsoDate | null;
};

export type AdminNewsPollOption = {
  id: string;
  label: string;
  startsAt: IsoDate | null;
  /** 日程調整: the most-voted candidate(s) */
  best: boolean;
  yes: number;
  maybe: number;
  no: number;
  /** who answered this option (answer only for 日程調整) */
  voters: { name: string; answer: "YES" | "MAYBE" | "NO" }[];
};

export type AdminNewsResponses = {
  done: number;
  total: number;
  deadline: IsoDate | null;
  remindedAt: IsoDate | null;
  pending: AdminReceipt[];
  /** who confirmed (null: no 確認 button) */
  confirmed: AdminReceipt[] | null;
  polls: {
    id: string;
    kind: "POLL" | "SCHEDULE";
    question: string;
    voters: number;
    options: AdminNewsPollOption[];
  }[];
};

export type AdminNewsDetail = AdminNewsBadges & {
  id: string;
  title: string;
  archived: boolean;
  /** admins, and the author: edit, archive, notify, delete */
  canEdit: boolean;
  /** 「会員画面で見る」 (published, not archived, canEdit) */
  viewAsMember: boolean;
  /** the read-only view (the website's NewsView) */
  view: {
    titleJa: string | null;
    titleEn: string | null;
    bodyJa: string | null;
    bodyEn: string | null;
    publishedAt: IsoDate | null;
    notifyOnPublish: boolean;
    pinned: boolean;
    requireConfirm: boolean;
    allowComments: boolean;
    deadline: IsoDate | null;
    audience: AdminAudienceSummary;
    poll: string | null;
    /** 日程調整 candidates (null: none) */
    scheduleCount: number | null;
    attachments: string[];
    /** signed URL (site-relative) */
    cover: string | null;
  };
  /** posts by 同窓会委員 (approvalRequired) */
  approval: {
    approvedAt: IsoDate | null;
    approvedBy: string | null;
    /** the viewer may approve (and isn't the author) */
    canApprove: boolean;
  } | null;
  /**
   * 公開して通知 (canEdit, not archived, not awaiting approval): sent at
   * `notifiedAt`, or ready to be sent.
   */
  notify: { notifiedAt: IsoDate | null; publishedAt: IsoDate | null } | null;
  /** 回答の受付 (published posts asking for something) */
  close: { closedAt: IsoDate | null; deadline: IsoDate | null } | null;
  /** 回答状況 (published posts asking for something) */
  responses: AdminNewsResponses | null;
  /** 既読 (published posts) */
  reads: {
    read: number;
    audience: number;
    /** most recent first, up to 200 */
    readers: AdminReceipt[];
  } | null;
  /** 通知の開封 (null until notified) */
  opens: {
    opened: (AdminReceipt & { channels: ("LINE" | "EMAIL" | "PUSH")[] })[];
    unopened: (AdminReceipt & { channels: ("LINE" | "EMAIL" | "PUSH")[] })[];
  } | null;
  /** the editor's values (canEdit only) */
  values: NewsFormValues | null;
};

/** 通知内容の確認: who the notification reaches. */
export type AdminNewsNotifyEstimate = {
  /** a draft or scheduled post is published now */
  publishNow: boolean;
  recipients: number;
  line: number;
  email: number;
  app: number;
  unreachable: number;
};

/**
 * `path`: the website page to show next, with its flags
 * ("/app/admin/news/x?notified=1", "?approved=1", "/app/admin/news?deleted=1").
 */
export type AdminNewsDone = { ok: true; path: string | null };
