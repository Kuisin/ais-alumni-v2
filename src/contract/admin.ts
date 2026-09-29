/**
 * 管理モード (the website's /app/admin). Pure types only (see core.ts):
 * change additively.
 */

// ---- GET /admin — admin-mode home (staff only) ----

/**
 * Work waiting for the committee (the website's admin sidebar badges).
 * All zero for staff who aren't committee admins.
 */
export type AdminCounts = {
  /** 本人確認: pending applications (not the ones following a parent's) */
  verification: number;
  /** 在籍情報の修正 */
  recordRequests: number;
  /** 氏名・生年月日: name, birth date and gender requests */
  nameRequests: number;
  /** お問い合わせ still open */
  support: number;
  /** チャット: reports still open */
  chat: number;
};

export type AdminHome = { counts: AdminCounts };

// ---- 名簿 (roster; committee admins) ----

/** Role keys used by the roster (RoleKey). */
export type RosterKind =
  | "TEACHER"
  | "CURRENT_STUDENT"
  | "CURRENT_PARENT"
  | "FORMER_STUDENT"
  | "FORMER_PARENT";

/** GET /admin/roster — what the roster holds. */
export type AdminRoster = {
  byKind: { kind: RosterKind; count: number }[];
  total: number;
  /** rows linked to an approved member */
  claimed: number;
};

/** A CSV row the import rejected (adminVerify.roster.rowErrors.<error>). */
export type RosterRowError = {
  line: number;
  error:
    | "missingName"
    | "badDate"
    | "badYear"
    | "yearsOrder"
    | "badKind"
    | "tooManyColumns";
};

/**
 * POST /admin/roster/import (multipart: `file` or `csv`, `intent`) — the
 * preview or import result (adminVerify.roster.messages.<message>).
 */
export type RosterImportResult = {
  ok: boolean;
  mode?: "preview" | "import";
  message?:
    | "forbidden"
    | "empty"
    | "tooMany"
    | "hasErrors"
    | "imported"
    | "preview"
    | "generic";
  total?: number;
  byKind?: Partial<Record<RosterKind, number>>;
  /** the first 20 */
  errors?: RosterRowError[];
  errorCount?: number;
  imported?: number;
};

/** DELETE /admin/roster { confirm: true } — delete every row. */
export type RosterDeleteResult = {
  ok: boolean;
  message?: "forbidden" | "confirm" | "deleted";
  deleted?: number;
};

// ---- 本人確認 (the website's /app/admin/verification) — committee admins ----

/** GET /admin/verification?tab=&q=&page= — which queue. */
export type VerificationTab = "pending" | "needsInfo";

/** One application in the queue (oldest first). */
export type VerificationQueueItem = {
  id: string;
  /** applicant's display name */
  name: string;
  /** RoleKey codes (roles.role.<code>) */
  roles: string[];
  /** a child registered by a parent: the parent's name */
  registeredBy: string | null;
  /** a parent: "名前（26期）、…" (adminVerify.queue.children) */
  children: string | null;
  submittedAt: string;
  /** compact date, "2026/09/27" / "Sep 27, 2026" (Japan time) */
  submittedDate: string;
  /** how long ago, "3日前" / "3 days ago" */
  age: string;
  /** signed up through an invitation */
  invite: { grade: boolean; mismatch: boolean } | null;
  rosterScore: number | null;
  /** rosterScore at or above the match threshold */
  rosterMatch: boolean;
  vouches: {
    total: number;
    yes: number;
    no: number;
    unsure: number;
    pending: number;
  };
  diploma: boolean;
  /** number of evidence files */
  evidence: number;
  schoolEmail: boolean;
  minor: boolean;
  /** a minor with a confirmed parent link */
  parentConfirmed: boolean;
};

export type VerificationQueue = {
  tab: VerificationTab;
  /** the search as applied (trimmed, max 60) */
  q: string;
  page: number;
  pages: number;
  /** open applications per tab (not narrowed by the search) */
  counts: Record<VerificationTab, number>;
  items: VerificationQueueItem[];
};

/** A label / value line composed by the server (the member's language). */
export type AdminDetailRow = { label: string; value: string };

/** One block of the application's answers (AnswersView). */
export type VerificationAnswerSection = {
  title: string;
  rows: AdminDetailRow[];
  /** 保護者: one list of rows per child */
  items?: AdminDetailRow[][];
};

/** A parent's child, as the committee checks it (ChildrenReview). */
export type VerificationChildCard = {
  linkId: string;
  /** the child's account, if any (links to the member in 管理モード) */
  childId: string | null;
  name: string;
  /** adminVerify.children.source.<source> */
  source: "nameOnly" | "created" | "registered";
  /** adminVerify.children.link.<link>; null = nothing to show */
  link: "confirmed" | "onApproval" | "childToConfirm" | null;
  /** null when there's no child account (name only) */
  details: {
    dateOfBirth: string | null;
    cohort: string | null;
    status: string | null;
    years: string;
    studentId: string | null;
    /** created by this parent: the roster check (score null = no data) */
    roster: { score: number | null; match: boolean } | null;
  } | null;
};

export type VerificationInvite = {
  kind: "GRADE" | "INDIVIDUAL";
  uses: number;
  maxUses: number;
  inviterId: string;
  inviterName: string;
  createdAt: string;
  /** what the inviter said: "卒業生（26期）" */
  said: string;
  inviteeName: string | null;
  /** adminVerify.invite.match.<match> */
  match: "match" | "mismatch" | "unknown";
};

export type VerificationEvidence = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  diploma: boolean;
  deleteAfter: string | null;
  /** signed /api/files URL (relative; valid 15 minutes) */
  url: string;
};

/** GET /admin/verification/[id] — the application and its decision. */
export type VerificationDetail = {
  id: string;
  applicantId: string;
  name: string;
  /** VerificationStatus (adminVerify.status.<status>) */
  status: string;
  submittedAt: string;
  /** PENDING: the decision form is shown */
  open: boolean;
  /** PENDING or NEEDS_INFO: other members can be asked */
  canAddVoucher: boolean;
  /** decided: the next pending application (oldest first) */
  nextId: string | null;
  schoolEmailVerified: boolean;
  minor: boolean;
  parentConfirmed: boolean;
  lastDecision: {
    decidedAt: string | null;
    reviewer: string | null;
    note: string | null;
  } | null;
  account: {
    email: string | null;
    /** AccountState (roles.state.<state>) */
    state: string;
    dateOfBirth: string | null;
    schoolEmail: { address: string; verified: boolean } | null;
    parents: { name: string; confirmed: boolean }[];
    children: { name: string; linked: boolean }[];
  };
  invite: VerificationInvite | null;
  /** child accounts a parent created that match this applicant */
  managedDuplicates: { id: string; name: string; registeredBy: string }[];
  /** the applicant is a parent: their children (else null) */
  children: VerificationChildCard[] | null;
  /** null: submitted in the old format */
  answers: VerificationAnswerSection[] | null;
  roster: {
    score: number;
    match: boolean;
    row: {
      nameRomaji: string;
      nameKanji: string | null;
      dateOfBirth: string | null;
      years: string;
      /** RoleKey (roles.role.<kind>) */
      kind: string;
      claimed: "applicant" | "other" | null;
    } | null;
  } | null;
  vouches: {
    id: string;
    name: string;
    /** vouch.answers.<answer>; null = not answered yet */
    answer: "YES" | "NO" | "NOT_SURE" | null;
    at: string;
  }[];
  evidence: VerificationEvidence[];
};

/** GET /admin/verification/[id]/vouchers?q= — members to ask. */
export type VoucherCandidate = {
  id: string;
  name: string;
  nameRomaji: string | null;
};

/**
 * POST /admin/verification/[id]/decision { decision, note } and
 * POST /admin/verification/[id]/vouchers { voucherId }: the website's form
 * result (adminVerify.messages.<message>, errors: field → adminVerify.errors.<code>).
 */
export type VerificationActionResult = {
  ok: boolean;
  message?:
    | "saved"
    | "forbidden"
    | "validation"
    | "notFound"
    | "conflict"
    | "generic";
  errors?: Record<string, string>;
};

export type VerificationDecision = "APPROVE" | "REJECT" | "NEEDS_INFO";
// ---- Change requests (氏名・生年月日・性別, 在籍情報; committee admins) ----

/** ?tab= of the review lists. */
export type AdminRequestTab = "pending" | "decided";

export type AdminRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

/** Who asked (links to the member's admin page when the app has one). */
export type AdminRequestMember = { id: string; name: string };

/** Shared by every request kind. */
export type AdminRequestBase = {
  id: string;
  member: AdminRequestMember;
  createdAt: string;
  status: AdminRequestStatus;
  /** decided ones */
  reviewer: string | null;
  reviewNote: string | null;
  decidedAt: string | null;
};

/** One line of a name request: before → after, composed as on the website. */
export type AdminNameLine = {
  /** romaji / kanji → common.names.{romaji,kanjiShort}; kana → kanaShort;
   * nameAtAis → profile.nameRequest.nameAtAis */
  field: "romaji" | "kanji" | "kana" | "nameAtAis";
  before: string | null;
  after: string | null;
};

export type AdminNameRequest = AdminRequestBase & {
  lines: AdminNameLine[];
  reason: string;
};

export type AdminBirthDateRequest = AdminRequestBase & {
  /** YYYY-MM-DD */
  current: string | null;
  proposed: string;
  reason: string | null;
};

export type AdminGenderRequest = AdminRequestBase & {
  /** MALE / FEMALE / OTHER (profile.photo.genders); null = not set */
  current: string | null;
  proposed: string | null;
  reason: string | null;
};

/** GET /admin/name-requests?tab= — the three kinds, 50 each. */
export type AdminNameRequests = {
  tab: AdminRequestTab;
  /** name + birth date + gender requests waiting */
  pendingCount: number;
  names: AdminNameRequest[];
  birthDates: AdminBirthDateRequest[];
  genders: AdminGenderRequest[];
};

export type AdminDecision = "APPROVE" | "REJECT";

/**
 * POST /admin/name-requests/[id]/decide { kind, decision, note } — note is
 * required to reject.
 */
export type AdminNameDecisionBody = {
  kind: "name" | "birthDate" | "gender";
  decision: AdminDecision;
  note: string;
};

/** `message`: key in the adminMembers namespace. */
export type AdminNameDecisionResult = { ok: boolean; message: string };

/** One field of a 在籍情報 correction (records.fields.<field>). */
export type AdminRecordDiffRow = {
  field: "cohort" | "yearsFrom" | "yearsTo" | "subjects" | "studentIdNo";
  /** display text (学年 labels resolved); null = empty */
  before: string | null;
  after: string | null;
};

export type AdminRecordRequest = AdminRequestBase & {
  /** RoleKey (roles.role.<role>) */
  role: string;
  diff: AdminRecordDiffRow[];
  reason: string;
};

/** GET /admin/record-requests?tab= — 50 at most. */
export type AdminRecordRequests = {
  tab: AdminRequestTab;
  pendingCount: number;
  requests: AdminRecordRequest[];
};

/** POST /admin/record-requests/[id]/decide { decision, note }. */
export type AdminRecordDecisionBody = { decision: AdminDecision; note: string };

/** `message`: key in the records namespace. */
export type AdminRecordDecisionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: { reason?: string };
};

// ---- 教職員 (admins and 教職員登録担当) ----

export type AdminTeacher = {
  id: string;
  name: string;
  /** a verified school address */
  schoolEmailVerified: boolean;
  schoolEmail: string | null;
  yearsFrom: number | null;
  subjects: string | null;
};

/** A member who could be made a current teacher (search results). */
export type AdminTeacherCandidate = {
  id: string;
  name: string;
  /** RoleKeys (roles.role.<role>) */
  roles: string[];
};

/** GET /admin/teachers?q= — current teachers; candidates when q is given (20). */
export type AdminTeachers = {
  current: AdminTeacher[];
  q: string;
  results: AdminTeacherCandidate[];
};
