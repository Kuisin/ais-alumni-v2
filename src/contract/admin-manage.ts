/**
 * Admin mode, committee pages (the website's /app/admin/(committee)/…):
 * 学年, 進路, 学校・会社, 統計, 監査ログ, お問い合わせ, チャット, LINE.
 * All endpoints are for admins only (actionAdmin), under /admin/….
 * Pure types (see core.ts).
 */

/** ISO 8601 timestamp (as core.ts). */
type IsoDate = string;

/**
 * A form action's result: `message` is a key in the page's namespace
 * (cohorts, organizations, adminMembers.positions …), as on the website.
 */
export type AdminFormResult = { ok?: boolean; message?: string };

// ---- 学年: GET /admin/cohorts ----

export type AdminCohortRep = { id: string; name: string; kanji: string | null };

export type AdminCohort = {
  id: string;
  number: number;
  graduated: boolean;
  /** "2020年 小学校卒業" (the label without 第n期) */
  subtitle: string;
  members: number;
  note: string | null;
  elementaryStartYear: number;
  elementaryEndYear: number;
  reps: AdminCohortRep[];
  /** no members, leaders or notifications use it */
  deletable: boolean;
};

export type AdminCohorts = { cohorts: AdminCohort[] };

/** PUT /admin/cohorts/:id (→ AdminFormResult, key in "cohorts") */
export type AdminCohortInput = {
  elementaryStartYear: string;
  elementaryEndYear: string;
  note: string;
};

/**
 * GET /admin/cohorts/:id/students?q= → AdminCohortRep[];
 * POST /admin/cohorts/:id/reps { userId, on } → AdminFormResult
 * (key in "adminMembers.positions").
 */
export type AdminCohortRepInput = { userId: string; on: boolean };

// ---- 学校・会社: GET /admin/organizations?kind=&sort=&q= ----

export type OrgKind = "school" | "company";

export type AdminOrg = { id: string; name: string; count: number };

export type AdminOrgs = {
  kind: OrgKind;
  sort: "name" | "count";
  q: string;
  rows: AdminOrg[];
  /** matches (rows holds at most 200) */
  total: number;
  counts: Record<OrgKind, number>;
};

/**
 * POST /admin/organizations/rename { kind, id, name },
 * POST /admin/organizations/merge { kind, id, targetId },
 * POST /admin/organizations/delete { kind, id } → AdminFormResult
 * (key in "organizations").
 */
export type AdminOrgRenameInput = { kind: OrgKind; id: string; name: string };
export type AdminOrgMergeInput = {
  kind: OrgKind;
  id: string;
  targetId: string;
};

// ---- 進路: GET /admin/destinations?cohort=&hist=0|1&all=1 ----

export type BarRow = { key: string; label: string; value: number };

export type BarChart = {
  id: string;
  title: string;
  note?: string;
  rows: BarRow[];
  /** denominator for the share; the sum of rows when absent */
  total?: number;
};

export type DestinationPerson = {
  id: string;
  name: string;
  /** "第9期" or "—" */
  cohort: string;
  /** "2020年卒業" / "2018年転出" */
  left: string | null;
  /** the first three school levels (history.levels.*) */
  schools: { level: string; label: string; name: string | null }[];
  now: { kind: "work" | "school"; name: string } | null;
  hasHistory: boolean;
};

export type AdminDestinations = {
  cohorts: { id: string; label: string }[];
  cohortId: string;
  onlyHistory: boolean;
  formerStudents: number;
  withHistory: number;
  charts: BarChart[];
  /** people matching the filter; `people` is the first 30 unless all=1 */
  listed: number;
  people: DestinationPerson[];
};

// ---- 統計: GET /admin/stats ----

export type AdminStats = {
  activeMembers: number;
  totalAccounts: number;
  lineLinked: number;
  lineFollowing: number;
  charts: BarChart[];
};

// ---- 監査ログ: GET /admin/audit?action=&target=&cursor= ----

export type AuditPerson = { id: string; label: string };

export type AuditEntry = {
  id: string;
  action: string;
  /** audit.actions.<action>, when there is one */
  label: string | null;
  createdAt: IsoDate;
  /** pretty-printed JSON, when there is any */
  data: string | null;
  /** null = the system */
  actor: AuditPerson | null;
  target: {
    id: string;
    type: string | null;
    typeLabel: string | null;
    /** website path of its admin page (map with hrefFor) */
    path: string | null;
    person: string | null;
  } | null;
  /** the applicant behind a verification request */
  applicant: AuditPerson | null;
};

export type AdminAudit = {
  entries: AuditEntry[];
  nextCursor: string | null;
};

// ---- お問い合わせ: GET /admin/support?tab=open|closed ----

export type AdminSupportRequest = {
  id: string;
  ref: string;
  type: string;
  topic: string;
  subject: string;
  message: string;
  name: string;
  email: string;
  member: AuditPerson | null;
  page: string | null;
  locale: "ja" | "en";
  createdAt: IsoDate;
  closedAt: IsoDate | null;
};

export type AdminSupport = {
  tab: "open" | "closed";
  counts: { open: number; closed: number };
  requests: AdminSupportRequest[];
};

/** POST /admin/support/:id { close } and /admin/chat/reports/:id { close } */
export type AdminCloseInput = { close: boolean };

// ---- チャット: GET /admin/chat?tab=open|closed ----

export type DirectChatRule = "ANYONE" | "SAME_ROLE" | "NOBODY";

export type AdminChatReport = {
  id: string;
  ref: string;
  reason: string;
  createdAt: IsoDate;
  closedAt: IsoDate | null;
  /** null = the talk is gone */
  chat: { id: string; direct: boolean; name: string } | null;
  reporter: AuditPerson | null;
  /** null with wholeChat = the whole talk was reported */
  reported: AuditPerson | null;
  wholeChat: boolean;
  detail: string;
  messages: { id: string; name: string; body: string; createdAt: IsoDate }[];
};

export type AdminChat = {
  /** role → rule, for the roles in `ruleRoles` (their order) */
  rules: Record<string, DirectChatRule>;
  ruleRoles: string[];
  tab: "open" | "closed";
  counts: { open: number; closed: number };
  reports: AdminChatReport[];
};

/** PUT /admin/chat/rules { rules } → { ok } | { error } */
export type AdminChatRulesInput = { rules: Record<string, DirectChatRule> };

// ---- LINE: GET /admin/line ----

export type AdminLine = {
  configured: boolean;
  installed: boolean;
  isDefault: boolean;
  usage: {
    quota: { used: number; limit: number | null } | null;
    byCategory: { category: string; count: number }[];
  };
  previews: {
    locale: "ja" | "en";
    /** site-relative PNG URLs (need the bearer header) */
    image: string;
    imageDots: string;
    replies: { key: string; label: string }[];
    items: { key: string; label: string; path: string }[];
  }[];
};

/** POST /admin/line/richmenu */
export type RichMenuResult = {
  ok?: boolean;
  error?: "notConfigured" | "failed";
  detail?: string;
  linked?: number;
  removed?: number;
};
