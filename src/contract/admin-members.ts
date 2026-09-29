/**
 * 管理モード → 会員 (the website's /app/admin/members and members/[id]).
 * Committee admins only. Pure types only (see core.ts): change additively.
 */

/** ISO 8601 timestamp. */
type IsoDate = string;
type Choice = { value: string; label: string };

/**
 * What a website admin form's server action answers, as is: `message` /
 * `error` are already in the member's language; `fieldErrors` holds the
 * action's codes per field ("schoolEmailTaken", "yearsOrder", …).
 */
export type AdminResult = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type AccountStateKey =
  | "UNVERIFIED_EMAIL"
  | "EMAIL_VERIFIED"
  | "PENDING_REVIEW"
  | "NEEDS_INFO"
  | "ACTIVE"
  | "REJECTED"
  | "DEACTIVATED";

export type RoleKeyName =
  | "TEACHER"
  | "CURRENT_STUDENT"
  | "CURRENT_PARENT"
  | "FORMER_STUDENT"
  | "FORMER_PARENT";

/** LINE: not linked / linked and following the official account / blocked it */
export type LineStatus = "notLinked" | "following" | "linkedNotFollowing";

// ---- GET /admin/members?q=&state=&role=&line=&admin=1&cursor= ----

export type AdminMemberRow = {
  id: string;
  /** null = no name yet (adminMembers.noName) */
  name: string | null;
  otherName: string | null;
  email: string | null;
  state: string;
  /** roles.state.<state> */
  stateLabel: string;
  isAdmin: boolean;
  /** 教職員（元教職員）, 卒業生 … */
  roles: string[];
  line: LineStatus;
  createdAt: IsoDate;
};

export type AdminMemberList = {
  /** matches for the filters (all pages) */
  total: number;
  items: AdminMemberRow[];
  /** pass as ?cursor= for the next 25; null = last page */
  nextCursor: string | null;
  filters: {
    states: Choice[];
    roles: Choice[];
  };
};

// ---- GET /admin/members/[id] ----

/** One role's inputs (adminMembers.roles form); computed ones read-only. */
export type AdminRoleValues = {
  role: RoleKeyName;
  /** 学年 as its 第N期 number */
  cohortNumber: number | null;
  teacherStatus: "CURRENT" | "FORMER" | null;
  yearsFrom: number | null;
  yearsTo: number | null;
  subjects: string | null;
  schoolEmail: string | null;
  schoolEmailVerified: boolean;
  currentGrade: number | null;
  studentIdNo: string | null;
  graduationOrLeaveYear: number | null;
  didGraduate: boolean | null;
  /** LifeStage — roles.stage.<stage> */
  currentStage: string | null;
  currentStageDetail: string | null;
};

export type AdminMemberRole = {
  role: RoleKeyName;
  /** 卒業生, 教職員 … */
  label: string;
  /** 卒業生 · 2014 · 大学生 (the website's row title) */
  title: string;
  /** the 在籍記録 facts (as on the profile) */
  facts: string[];
  /** teachers: 担当科目 */
  subjects: string | null;
  /** 教職員（在職）, 在校生 · 10年生, 2014年卒業 — computed, read-only */
  derived: string | null;
  /** former students: 現在の状況 (from 学歴・職歴), null = unknown */
  stage: string | null;
  stageUpdatedAt: IsoDate | null;
  values: AdminRoleValues;
};

export type AdminPositionKey =
  | "TEACHER_MANAGER"
  | "TEACHER_REGISTRAR"
  | "ALUMNI_COMMITTEE"
  | "STUDENT_LEADER";

export type AdminMemberPosition = {
  position: AdminPositionKey;
  held: boolean;
  /** 学年代表: the 学年 held (第N期 number) */
  cohortNumber: number | null;
  /** suggested 学年: the member's own student 学年 */
  defaultCohortNumber: number | null;
  /** may hold it (positionEligible) */
  eligible: boolean;
  /** 学年 choices (学年代表: only the member's own 学年) */
  cohorts: Choice[];
};

export type AdminFamilyLink = {
  id: string;
  /** the other person's side: they are the member's parent / child */
  as: "parent" | "child";
  other: { id: string; name: string; otherName: string | null } | null;
  /** a child without an account (name given by the parent) */
  childName: string | null;
  confirmed: boolean;
};

export type AdminAuditEntry = {
  id: string;
  /** audit.actions.<action>, or the raw action when there's no label */
  label: string;
  action: string;
  actor: string | null;
  /** the target, resolved to a name when it's a member */
  target: string | null;
  /** the target member (for a link) */
  targetUserId: string | null;
  createdAt: IsoDate;
};

export type AdminMemberDetail = {
  id: string;
  name: string | null;
  otherName: string | null;
  email: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  /** the signed-in admin themself */
  isSelf: boolean;
  state: AccountStateKey;
  stateLabel: string;
  roleLabels: string[];
  line: { status: LineStatus; displayName: string | null };
  /** "email", "google", "line" … */
  providers: string[];
  notifyVia: string;
  createdAt: IsoDate;
  deactivatedAt: IsoDate | null;
  profile: {
    lastNameRomaji: string;
    firstNameRomaji: string;
    middleNameRomaji: string;
    lastNameKanji: string;
    firstNameKanji: string;
    lastNameKana: string;
    firstNameKana: string;
    nameAtAis: string;
    /** YYYY-MM-DD or "" */
    dateOfBirth: string;
    bio: string;
    phone: string;
    /** MALE | FEMALE | OTHER | "" */
    gender: string;
  };
  roles: AdminMemberRole[];
  /** role types that can be added (student / parent / teacher) */
  addableRoles: RoleKeyName[];
  /** 学年 choices for role forms, newest first (value = 第N期 number) */
  cohorts: Choice[];
  positions: AdminMemberPosition[];
  family: {
    links: AdminFamilyLink[];
    /** others in the same family without a direct link (siblings etc.) */
    relatives: { id: string; name: string }[];
  };
  /** the latest 10 entries by or about the member */
  audit: AdminAuditEntry[];
};

// ---- POST bodies (answers: AdminResult) ----

/** POST /admin/members/[id]/profile */
export type AdminProfileUpdate = AdminMemberDetail["profile"];

/** POST /admin/members/[id]/roles — add or save one role */
export type AdminRoleUpdate = {
  role: RoleKeyName;
  cohortNumber: string;
  yearsFrom: string;
  yearsTo: string;
  subjects: string;
  schoolEmail: string;
  studentIdNo: string;
};

/** DELETE /admin/members/[id]/roles/[role] */

/** POST /admin/members/[id]/state */
export type AdminStateUpdate = { state: "ACTIVE" | "DEACTIVATED" };

/** POST /admin/members/[id]/admin */
export type AdminRightsUpdate = { grant: boolean };

/** POST /admin/members/[id]/positions (answer message: adminMembers.positions.<key>) */
export type AdminPositionUpdate = {
  position: AdminPositionKey;
  grant: boolean;
  cohortNumber: string;
};

// ---- Family ----

/** GET /admin/members/[id]/family/candidates?as=parent|child&q= */
export type AdminFamilyCandidate = {
  id: string;
  name: string;
  other: string | null;
};

/** POST /admin/members/[id]/family  { otherId, as } */
export type AdminFamilyAdd = { otherId: string; as: "parent" | "child" };
/** answer: message = key in adminMembers (family.linked, family.errors.x …) */
export type AdminFamilyResult = { ok: boolean; message?: string };
// POST /admin/members/[id]/family/[linkId]/confirm, DELETE …/family/[linkId]

// ---- Merge ----

export type AdminMergeSide = {
  id: string;
  name: string;
  email: string | null;
  state: string;
  roles: string[];
  providers: string[];
  lineLinked: boolean;
  isAdmin: boolean;
  createdAt: IsoDate;
};

/** POST /admin/members/[id]/merge */
export type AdminMergeRequest =
  | { intent: "preview"; other: string; keep: "this" | "other" }
  | {
      intent: "confirm";
      keepId: string;
      duplicateId: string;
      /** bypass the "keepsManaged" safety check */
      force?: boolean;
    };

export type AdminMergeResult = AdminResult & {
  preview?: { keep: AdminMergeSide; duplicate: AdminMergeSide };
  blocked?: "keepsManaged";
  /** merged: the kept account (open it) */
  mergedInto?: string;
};
