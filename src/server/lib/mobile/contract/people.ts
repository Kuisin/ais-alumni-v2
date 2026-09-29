/**
 * People: the member directory (名簿), member profiles and follows — the
 * website's /app/directory, /app/members/[id] and /app/follows. Pure types
 * (see core.ts for the conventions). Text the server composes (role facts,
 * cohort labels, history years) is already in the member's language; the
 * rest are codes the app translates with the website's messages.
 */

/**
 * The follow button (src/lib/follows.ts followButtonState):
 * none 「フォローする」 · followBack 「フォローバック」 · requested
 * 「リクエスト済み」 (cancels) · following 「フォロー中」 (unfollow, confirmed).
 */
export type FollowUiState = "none" | "followBack" | "requested" | "following";

/** One role on a member card: its badge and public facts. */
export type RoleLine = {
  /** 「卒業生」「教職員」… */
  label: string;
  /** e.g. ["第5期", "2016年卒業", "小学校", "現在: 社会人"] — shown joined by " · " */
  facts: string[];
};

/** A member in a list (public tier only). */
export type MemberCard = {
  id: string;
  /** displayName(): the romaji name, else kanji */
  name: string;
  /** kanji（kana） */
  otherName: string | null;
  /** photo, or the default icon when this member may not see it */
  avatar: string;
  /** 在籍時の氏名 (shown as profile.nameAtAisValue) */
  nameAtAis: string | null;
  roles: RoleLine[];
};

// ---- GET /directory ----
// Query parameters as on the website: q, role, from, to, division, stage,
// cohort, cursor. role defaults to FORMER_STUDENT (卒業生＋元在校生);
// role=all lists every role. Invalid values are ignored.

/** The filters as the server applied them. */
export type DirectoryFilters = {
  q: string | null;
  /** a DirectoryOptions.roles value, or "all" */
  role: string;
  from: number | null;
  to: number | null;
  /** DirectoryOptions.divisions value (roles.division.<value>) */
  division: string | null;
  /** DirectoryOptions.stages value (roles.stage.<value>) */
  stage: string | null;
  /** DirectoryOptions.cohorts id */
  cohort: string | null;
};

export type DirectoryPage = {
  items: MemberCard[];
  /** pass as ?cursor= for the next page; null = last page */
  nextCursor: string | null;
  /** members matching the filters, all pages */
  total: number;
  filters: DirectoryFilters;
  /** a filter differs from the default (directory.empty vs emptyAll) */
  filtered: boolean;
};

// ---- GET /directory/options ----

export type DirectoryOptions = {
  /** 区分 choices in order, labelled roles.audience.<value> */
  roles: string[];
  /** used when no role is given */
  defaultRole: string;
  /** the value for 「すべての区分」 (directory.filters.anyRole) */
  allRoles: string;
  /** 最終在籍部, labelled roles.division.<value> */
  divisions: string[];
  /** 現在の状況, labelled roles.stage.<value> */
  stages: string[];
  /** 学年, labels composed ("第5期（2016年 小学校卒業）") */
  cohorts: { id: string; label: string }[];
  minYear: number;
  maxYear: number;
};

// ---- GET /members/[id] (?as=members|followers|family: my own profile as others see it) ----
// errors: not_found (404: no such member, or not visible to you),
// self (409: your own profile without ?as — open the profile tab instead)

export type ProfileAudience = "members" | "followers" | "family";

export type SocialKey = "instagram" | "linkedin" | "facebook" | "x" | "website";

export type HistoryEducation = {
  id: string;
  school: string;
  /** history.levels.<level>, translated */
  level: string;
  field: string | null;
  /** "2019–2022", "2022–現在" */
  years: string;
};

export type HistoryWork = {
  id: string;
  company: string;
  title: string | null;
  /** 業種 / 職種 labels ("メーカー › 自動車・自動車部品") */
  industry: string | null;
  jobType: string | null;
  years: string;
};

export type MemberProfile = {
  id: string;
  name: string;
  otherName: string | null;
  nameAtAis: string | null;
  /** photo, or the default icon */
  avatar: string;
  /** they have a photo this member may not see (profile.visibility.photoHidden) */
  photoHidden: boolean;
  /** role badges, as on the website */
  roles: string[];
  bio: string | null;
  /** AIS在籍記録: one entry per role (details: facts, or profile.record.noDetails) */
  record: { label: string; details: string; subjects: string | null }[];
  /** 現在の状況 (former students only); label null = profile.stageNotSet */
  currentStage: { label: string | null; detail: string | null } | null;
  /** 学歴・職歴; null when they have none at all */
  history: {
    education: HistoryEducation[];
    work: HistoryWork[];
    /** entries only followers and family see (profile.visibility.historyHidden) */
    hiddenCount: number;
  } | null;
  /** accepted follows only */
  counts: { followers: number; following: number };
  relationship: {
    /** 「家族」 badge; family never get a follow button */
    family: boolean;
    /** 「フォローされています」 badge */
    followsYou: boolean;
    /** the follow button; null = none (family, minors, blocked, preview…) */
    follow: FollowUiState | null;
    /** show follows.followHint under the button */
    canRequest: boolean;
    /** I blocked them: show 「ブロック解除」 */
    blockedByMe: boolean;
    /** show 「メッセージ」 (POST /chat/direct) */
    canMessage: boolean;
    /** show the ⋯ menu (block) */
    menu: boolean;
  };
  contact: {
    /** all: self/family/admin · followers: only the fields they share · none */
    access: "all" | "followers" | "none";
    /** date of birth, admins only (null = not shown); value null = not set */
    birthDate: { value: string | null } | null;
    email: string | null;
    phone: string | null;
    lineDisplayName: string | null;
    /** in the website's order (profile.fields.<key>) */
    social: { key: SocialKey; url: string }[];
    /**
     * Why the personal fields aren't shown (profile.locked.<reason>); null
     * when the viewer sees them (then no values = profile.noContact, or
     * noContactFollowers for followers).
     */
    locked: "familyOnly" | "requested" | "body" | "unavailable" | null;
    /**
     * Fields kept from the viewer, named but never their values:
     * profile.followerFields.fields.<key>, and "birthDate"
     * (profile.birthDate.title).
     */
    hidden: string[];
  };
  /** set when viewing my own profile as an audience (「〇〇として見る」) */
  preview: ProfileAudience | null;
};

// ---- POST /members/[id]/follow ----
/** ACCEPTED: auto-accepted (follows.status.autoAccepted), else requestSent. */
export type FollowResult = { status: "REQUESTED" | "ACCEPTED" };
// errors (follows.errors.<code>): self, inactive, blocked, minor, family (403),
// already (409), rateLimited (429), notFound (404)

// ---- DELETE /members/[id]/follow → { ok: true } (unfollow, or cancel my request)
// ---- POST /members/[id]/block → { ok: true } (errors: self 400, not_found 404)
// ---- DELETE /members/[id]/block → { ok: true } (unblock)

export type Ok = { ok: true };

// ---- GET /follows (?accepted=<followId>: the request I just accepted) ----

export type FollowRequestItem = {
  followId: string;
  requestedAt: string;
  member: MemberCard;
};

export type FollowLists = {
  /** requests to me (accept / decline) */
  incoming: FollowRequestItem[];
  /** my pending requests (cancel) */
  outgoing: FollowRequestItem[];
  /** accepted followers; followState = my button toward them (null = none) */
  followers: {
    followId: string;
    member: MemberCard;
    followState: FollowUiState | null;
  }[];
  /** members I follow (always "following") */
  following: { followId: string; member: MemberCard }[];
  /** members I blocked: default icon, no profile link (unblock) */
  blocked: { blockId: string; member: MemberCard }[];
  /** ?accepted=: 「〇〇さんのリクエストを承認しました。」 with a follow-back button */
  accepted: { member: MemberCard; followState: FollowUiState | null } | null;
};

// ---- POST /follows/requests/[followId]/accept ----
/** false: the request is gone (withdrawn, or already handled) */
export type AcceptResult = { accepted: boolean };
// ---- POST /follows/requests/[followId]/decline → { ok: true }
// ---- DELETE /follows/followers/[userId] → { ok: true } (remove a follower)
