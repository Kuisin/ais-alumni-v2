/**
 * Editing my profile (the website's /app/profile forms, /app/profile/history
 * and /app/profile/record) in the native app. Pure types only (see
 * core.ts): change additively. What's shown comes from GET /profile
 * (MyProfile, account.ts).
 *
 * Every form endpoint answers like the website's form actions:
 * - success: FormOk — `message` is a key in the form's namespace
 *   ("profile", "history" or "records", noted per endpoint);
 * - rejected: status 400 (403 for errors.forbidden) with FormError.
 */

import type { PersonalField, SocialKey } from "./account";

export type FormOk = { message: string };

/**
 * The error body of a rejected form: `error` is "form"; `message` a key in
 * the form's namespace ("errors.validation", "nameRequest.errors.pending"
 * …); `fieldErrors` a code per invalid field (the website's fieldErrors
 * codes: "required", "tooLong", "invalid", "invalidYear" …).
 */
export type FormError = {
  error: "form";
  message: string;
  fieldErrors?: Record<string, string>;
};

// ---- about / directory / photo / follower fields ("profile") ----

/** PUT /profile/about → FormOk. Empty strings clear a field. */
export type AboutUpdate = {
  bio: string;
  phone: string;
  /** former students only; left out: unchanged */
  autoAcceptSameYear?: boolean;
  social: Partial<Record<SocialKey, string>>;
};

/** PUT /profile/directory (parents only) → FormOk. */
export type DirectoryUpdate = { listed: boolean };

/** PUT /profile/photo/visibility → FormOk. */
export type PhotoVisibilityUpdate = { public: boolean };

/**
 * POST /profile/photo (multipart/form-data, file field "avatar": JPEG or
 * PNG, at most 2 MB) → FormOk ("photoUploaded").
 * DELETE /profile/photo → { ok: true } (back to the default icon).
 */

/** PUT /profile/follower-fields → FormOk. The fields followers may see. */
export type FollowerFieldsUpdate = { shared: PersonalField[] };

// ---- 学歴・職歴 (/profile/history, "history") ----

export type HistoryVisibility = "MEMBERS" | "FOLLOWERS";
export type EducationLevel =
  | "JUNIOR_HIGH"
  | "HIGH_SCHOOL"
  | "UNIVERSITY"
  | "GRADUATE_SCHOOL"
  | "VOCATIONAL"
  | "OTHER";

export type OrgRef = { id: string; name: string };

export type EducationEntry = {
  id: string;
  level: EducationLevel;
  school: OrgRef;
  field: string | null;
  startYear: number | null;
  endYear: number | null;
  visibility: HistoryVisibility;
  /** no end year (shown with 「現在」) */
  current: boolean;
};

export type WorkEntry = {
  id: string;
  company: OrgRef;
  title: string | null;
  /** codes (history.fields.industry / jobType) and their labels */
  industry: string | null;
  jobType: string | null;
  industryLabel: string | null;
  jobTypeLabel: string | null;
  startYear: number | null;
  endYear: number | null;
  visibility: HistoryVisibility;
  current: boolean;
};

/** 業種 / 職種: 大分類 and the details within, in the member's language. */
export type TwoLevelGroup = {
  code: string;
  label: string;
  children: { code: string; label: string }[];
};

/** GET /profile/history */
export type HistoryEditor = {
  /** current first, then most recent (as on the website) */
  education: EducationEntry[];
  work: WorkEntry[];
  /**
   * Several entries marked 現在: how many, and the one that sets 現在の状況
   * (history.multipleCurrent.*). Null otherwise.
   */
  multipleCurrent: { count: number; detail: string } | null;
  industries: TwoLevelGroup[];
  jobTypes: TwoLevelGroup[];
};

/**
 * POST /profile/history → FormOk ("added" / "saved"). With `id`: edit that
 * entry (own only). Years as typed ("" = none). School / company: an id
 * picked from GET /profile/orgs, or just the name (created once).
 */
export type HistoryInput =
  | {
      kind: "education";
      id?: string;
      level: string;
      school: string;
      schoolId?: string;
      field: string;
      startYear: string;
      endYear: string;
      visibility: HistoryVisibility;
    }
  | {
      kind: "work";
      id?: string;
      company: string;
      companyId?: string;
      title: string;
      industry: string;
      jobType: string;
      startYear: string;
      endYear: string;
      visibility: HistoryVisibility;
    };

/** DELETE /profile/history/{kind}/{id} → { ok: true } */

/** GET /profile/orgs?kind=school|company&q=… → OrgSearch */
export type OrgSearch = {
  options: { id: string; name: string; count: number }[];
};

// ---- 在校記録 corrections (/profile/record, "records") ----

export type RecordField =
  | "cohort"
  | "yearsFrom"
  | "yearsTo"
  | "subjects"
  | "studentIdNo";

export type RecordDiffRow = {
  field: RecordField;
  /** display values ("—", 「第4期」, 「在職中」 …) */
  current: string;
  proposed: string;
};

export type RecordRequestView = {
  id: string;
  role: string;
  roleLabel: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  reason: string;
  reviewNote: string | null;
  diff: RecordDiffRow[];
};

export type RecordRole = {
  role: string;
  label: string;
  /** the record as shown; teachers still at AIS: stillTeaching */
  rows: { field: RecordField; value: string; stillTeaching: boolean }[];
  /** correctable fields, in the form's order */
  fields: RecordField[];
  /** the form's starting values */
  values: Partial<Record<RecordField, string>>;
  pending: RecordRequestView | null;
};

/** GET /profile/record */
export type RecordPage = {
  roles: RecordRole[];
  /** 学年 choices (value = 第N期 number) */
  cohorts: { value: string; label: string; graduated: boolean }[];
  /** decided or withdrawn requests, newest first */
  history: RecordRequestView[];
};

/** POST /profile/record → FormOk ("submitted"). */
export type RecordRequestInput = {
  role: string;
  values: Partial<Record<RecordField, string>>;
  reason: string;
};

/** DELETE /profile/record/{id} → { ok: true } (withdraw a pending one). */

// ---- locked fields: requests to the committee ("profile") ----

export type NameFields = {
  lastNameRomaji: string;
  firstNameRomaji: string;
  middleNameRomaji: string;
  lastNameKanji: string;
  firstNameKanji: string;
  lastNameKana: string;
  firstNameKana: string;
};

/** POST /profile/name-request → FormOk ("nameRequest.submitted"). */
export type NameRequestInput = NameFields & {
  nameAtAis: string;
  reason: string;
};

/**
 * POST /profile/birth-date-request → FormOk ("birthDate.submitted").
 * dateOfBirth "YYYY-MM-DD"; a reason is needed to change a recorded date.
 */
export type BirthDateRequestInput = { dateOfBirth: string; reason: string };

/** POST /profile/gender-request → FormOk ("gender.submitted"). */
export type GenderRequestInput = { gender: string; reason: string };

/** POST /profile/gender (no gender recorded yet: set once) → FormOk ("gender.saved"). */
export type GenderSetInput = { gender: string };

/**
 * DELETE /profile/{name,birth-date,gender}-request/{id} → { ok: true }:
 * withdraw my pending request.
 */
