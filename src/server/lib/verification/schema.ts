import { z } from "zod";
import { elementaryEndFor, parseCohortNumber } from "@/server/lib/cohorts";
import { GENDERS } from "@/server/lib/gender";
import { kanaPart, nameColumns, requireKanaForKanji } from "@/server/lib/names";
import { isCurrentTeacher, studentStatus } from "@/server/lib/school";
import { isSchoolEmail } from "@/server/lib/school-email";

/**
 * Sign-up (verification) form, version 2. Shared by the client wizard
 * (per-step validation) and the server action (authoritative validation).
 * No server imports here. Error messages are i18n keys under
 * `verify.errors.*`.
 *
 * Members say what they are (student / parent / teacher) and give their
 * 学年 and years; whether they are current or former, their grade and
 * graduation are worked out automatically (src/lib/school.ts).
 */

export const EVIDENCE_MAX_FILES = 3;
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;
export const MAX_CHILDREN = 8;
export const MIN_YEAR = 1950;

export function maxYear(now: Date = new Date()): number {
  return now.getUTCFullYear() + 10;
}

/** What someone is at AIS; the exact role (current/former) is derived. */
export const MEMBER_TYPES = ["STUDENT", "PARENT", "TEACHER"] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];

const SECTION = {
  STUDENT: "student",
  PARENT: "parent",
  TEACHER: "teacher",
} as const;

// ---------------------------------------------------------------------------
// Primitive helpers

const text = (max = 200) => z.string().trim().max(max, "tooLong");
const requiredText = (max = 200) => text(max).min(1, "required");
const optionalText = (max = 200) =>
  text(max)
    .optional()
    .transform((v) => (v ? v : null));

function toNumber(v: unknown): unknown {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "string") return Number(v);
  return v;
}

const yearNumber = () =>
  z
    .number({ error: "required" })
    .int("invalidYear")
    .min(MIN_YEAR, "invalidYear")
    .max(maxYear(), "invalidYear");
const year = () => z.preprocess(toNumber, yearNumber());
// Empty → null (the preprocess turns "" into undefined before .optional()).
const optionalYear = () =>
  z.preprocess(toNumber, yearNumber().optional()).transform((v) => v ?? null);

/** 学年 as its 第N期 number (the class row is created on first use). */
const cohortNumber = () =>
  z
    .string({ error: "required" })
    .trim()
    .transform((v, ctx) => {
      const n = parseCohortNumber(v);
      if (n === null || n === undefined) {
        ctx.addIssue({
          code: "custom",
          message: n === null ? "cohortRequired" : "invalid",
        });
        return z.NEVER;
      }
      return n;
    });

const isoDate = z
  .string()
  .trim()
  .min(1, "required")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return (
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === s &&
      d.getUTCFullYear() >= 1900 &&
      d.getTime() <= Date.now()
    );
  }, "invalidDate");

function leftAfterJoined(
  v: { joinedYear: number; leftYear: number | null },
  ctx: z.RefinementCtx,
) {
  if (v.leftYear !== null && v.leftYear < v.joinedYear) {
    ctx.addIssue({ code: "custom", path: ["leftYear"], message: "yearsOrder" });
  }
}

// ---------------------------------------------------------------------------
// Sections

export const studentSchema = z
  .object({
    cohortNumber: cohortNumber(),
    joinedYear: year(),
    /** Left AIS before graduating (empty = still at AIS or graduated). */
    leftYear: optionalYear(),
    studentIdNo: optionalText(50),
    homeroomTeacher: optionalText(),
    /** Classmates the committee may ask to confirm (optional). */
    classmates: z
      .array(text())
      .max(2)
      .default([])
      .transform((a) => a.filter(Boolean)),
  })
  .superRefine(leftAfterJoined);

/**
 * A child is either already registered (picked by exact name + birth date,
 * see searchRegisteredChildAction) or new: the parent enters the child's
 * details and a child account managed by the parent is created. The admin
 * reviews the children's details (src/app/actions/verify.ts).
 */
export const CHILD_MODES = ["new", "existing"] as const;
export type ChildMode = (typeof CHILD_MODES)[number];

const newChildSchema = z
  .object({
    mode: z.literal("new"),
    lastNameRomaji: requiredText(50),
    firstNameRomaji: requiredText(50),
    lastNameKanji: optionalText(50),
    firstNameKanji: optionalText(50),
    lastNameKana: kanaPart(),
    firstNameKana: kanaPart(),
    dateOfBirth: isoDate,
    cohortNumber: cohortNumber(),
    joinedYear: year(),
    leftYear: optionalYear(),
    studentIdNo: optionalText(50),
  })
  .superRefine((v, ctx) => {
    leftAfterJoined(v, ctx);
    requireKanaForKanji(v, ctx);
  });

const existingChildSchema = z.object({
  mode: z.literal("existing"),
  existingUserId: z.string().trim().min(1, "childNotSelected").max(64),
  /** label shown when picked, e.g. 鈴木花子 */
  name: requiredText(),
});

export const childSchema = z.discriminatedUnion("mode", [
  newChildSchema,
  existingChildSchema,
]);
export type ChildData = z.infer<typeof childSchema>;

export const parentSchema = z.object({
  children: z.array(childSchema).min(1, "childrenRequired").max(MAX_CHILDREN),
});

export const teacherSchema = z
  .object({
    joinedYear: year(),
    /** Year they left AIS (empty = still working at AIS). */
    leftYear: optionalYear(),
    subjects: requiredText(300),
    schoolEmail: z
      .string()
      .trim()
      .max(254)
      .optional()
      .transform((v) => (v ? v.toLowerCase() : null))
      .pipe(z.email("invalidEmail").nullable())
      // AIS addresses only (the extra check that they work at AIS).
      .refine((v) => v === null || isSchoolEmail(v), "schoolEmailDomain"),
  })
  .superRefine(leftAfterJoined)
  // Current teachers (no leave year, or a future one) must give their
  // school address; it's confirmed with a code before sending.
  .superRefine((v, ctx) => {
    if (isCurrentTeacher(v.leftYear) && !v.schoolEmail)
      ctx.addIssue({
        code: "custom",
        path: ["schoolEmail"],
        message: "schoolEmailRequired",
      });
  });

/** 卒業証書 (one file) or other supporting documents (up to 3). */
export const EVIDENCE_KINDS = ["DIPLOMA", "OTHER"] as const;
export type EvidenceKindValue = (typeof EVIDENCE_KINDS)[number];

export const evidenceItemSchema = z.object({
  kind: z.enum(EVIDENCE_KINDS).default("OTHER"),
  key: z.string().min(1).max(500),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(EVIDENCE_TYPES),
  size: z.number().int().positive().max(EVIDENCE_MAX_BYTES),
});

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

/** Storage-safe file name (used for the object key; the original name is kept separately). */
export function safeFileName(name: string): string {
  const base = name
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+/, "");
  return (base || "file").slice(-80);
}

// ---------------------------------------------------------------------------
// Whole form

export function verificationSchema(_opts: { requireKanji: boolean }) {
  return z
    .object({
      types: z
        .array(z.enum(MEMBER_TYPES))
        .min(1, "typesRequired")
        .transform((t) => MEMBER_TYPES.filter((k) => t.includes(k))),
      lastNameRomaji: requiredText(50),
      firstNameRomaji: requiredText(50),
      middleNameRomaji: optionalText(50),
      // Kanji is optional (e.g. international students); フリガナ is
      // required with it. `requireKanji` is kept for callers but unused.
      lastNameKanji: optionalText(50),
      firstNameKanji: optionalText(50),
      lastNameKana: kanaPart(),
      firstNameKana: kanaPart(),
      nameAtAis: optionalText(100),
      dateOfBirth: isoDate,
      // Fixed after sending; changed later only by request (like the birth date).
      gender: z.enum(GENDERS, { error: "genderRequired" }),
      locale: z.enum(["ja", "en"]),
      student: studentSchema.optional(),
      parent: parentSchema.optional(),
      teacher: teacherSchema.optional(),
      evidence: z
        .array(evidenceItemSchema)
        .default([])
        .refine(
          (a) =>
            a.filter((e) => e.kind === "DIPLOMA").length <= 1 &&
            a.filter((e) => e.kind === "OTHER").length <= EVIDENCE_MAX_FILES,
          "tooManyFiles",
        ),
      /** a graduate who can't provide their 卒業証書 */
      diplomaUnavailable: z.boolean().default(false),
    })
    .superRefine((v, ctx) => {
      requireKanaForKanji(v, ctx);
      // Graduates upload their 卒業証書 (or say they don't have it).
      if (
        v.types.includes("STUDENT") &&
        v.student &&
        applicantGraduated(v.student.cohortNumber, v.student.leftYear) &&
        !v.diplomaUnavailable &&
        !v.evidence.some((e) => e.kind === "DIPLOMA")
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["diploma"],
          message: "diplomaRequired",
        });
      }
      for (const type of v.types) {
        if (!v[SECTION[type]]) {
          ctx.addIssue({
            code: "custom",
            path: [SECTION[type]],
            message: "required",
          });
        }
      }
    })
    .transform((v) => {
      // Drop sections for types that were not chosen; add combined names.
      const out = { ...v, ...nameColumns(v) };
      for (const type of MEMBER_TYPES) {
        if (!v.types.includes(type)) delete out[SECTION[type]];
      }
      return out;
    });
}

export type VerificationData = z.output<ReturnType<typeof verificationSchema>>;

/** Whether a student applicant finished 6th grade at AIS (by 学年 and leave year). */
export function applicantGraduated(
  cohortNumber: number | null | undefined,
  leftYear: number | null | undefined,
  now: Date = new Date(),
): boolean {
  if (cohortNumber == null) return false;
  return studentStatus(elementaryEndFor(cohortNumber), leftYear ?? null, now)
    .didGraduate;
}

/** What is stored in VerificationRequest.answers. */
export type StoredAnswers = Omit<VerificationData, "evidence"> & { version: 2 };

// ---------------------------------------------------------------------------
// Client form state (string-valued so inputs stay controlled)

export type ChildState = {
  mode: ChildMode;
  /** existing: the picked member and their label */
  existingUserId: string;
  name: string;
  /** new: the child's details */
  lastNameRomaji: string;
  firstNameRomaji: string;
  lastNameKanji: string;
  firstNameKanji: string;
  lastNameKana: string;
  firstNameKana: string;
  dateOfBirth: string;
  cohortNumber: string;
  joinedYear: string;
  leftYear: string;
  studentIdNo: string;
};

export type VerifyFormState = {
  types: MemberType[];
  lastNameRomaji: string;
  firstNameRomaji: string;
  middleNameRomaji: string;
  lastNameKanji: string;
  firstNameKanji: string;
  lastNameKana: string;
  firstNameKana: string;
  nameAtAis: string;
  dateOfBirth: string;
  gender: string;
  locale: "ja" | "en";
  student: {
    cohortNumber: string;
    joinedYear: string;
    leftYear: string;
    studentIdNo: string;
    homeroomTeacher: string;
    classmates: [string, string];
  };
  parent: { children: ChildState[] };
  teacher: {
    joinedYear: string;
    leftYear: string;
    subjects: string;
    schoolEmail: string;
  };
  evidence: EvidenceItem[];
  diplomaUnavailable: boolean;
};

export const emptyChild = (mode: ChildMode = "new"): ChildState => ({
  mode,
  existingUserId: "",
  name: "",
  lastNameRomaji: "",
  firstNameRomaji: "",
  lastNameKanji: "",
  firstNameKanji: "",
  lastNameKana: "",
  firstNameKana: "",
  dateOfBirth: "",
  cohortNumber: "",
  joinedYear: "",
  leftYear: "",
  studentIdNo: "",
});

export function emptyFormState(locale: "ja" | "en"): VerifyFormState {
  return {
    types: [],
    lastNameRomaji: "",
    firstNameRomaji: "",
    middleNameRomaji: "",
    lastNameKanji: "",
    firstNameKanji: "",
    lastNameKana: "",
    firstNameKana: "",
    nameAtAis: "",
    dateOfBirth: "",
    gender: "",
    locale,
    student: {
      cohortNumber: "",
      joinedYear: "",
      leftYear: "",
      studentIdNo: "",
      homeroomTeacher: "",
      classmates: ["", ""],
    },
    parent: { children: [emptyChild()] },
    teacher: { joinedYear: "", leftYear: "", subjects: "", schoolEmail: "" },
    evidence: [],
    diplomaUnavailable: false,
  };
}

/** The JSON the client posts: only sections for the chosen types. */
export function toPayload(state: VerifyFormState): Record<string, unknown> {
  const { student, parent, teacher, ...common } = state;
  const sections = { student, parent, teacher };
  const out: Record<string, unknown> = { ...common };
  for (const type of state.types) out[SECTION[type]] = sections[SECTION[type]];
  return out;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);

/**
 * Stored answers → form state (NEEDS_INFO resubmission). Answers from the
 * older (version 1) form are not mapped; the member re-enters the details.
 */
export function answersToFormState(
  answers: unknown,
  locale: "ja" | "en",
  evidence: EvidenceItem[] = [],
): VerifyFormState {
  const base = emptyFormState(locale);
  const a = obj(answers);
  if (a.version !== 2) return { ...base, evidence };
  const st = obj(a.student);
  const tc = obj(a.teacher);
  const children = arr(obj(a.parent).children).map(obj);
  const classmates = arr(st.classmates).map(s);
  const types = arr(a.types).filter((t): t is MemberType =>
    (MEMBER_TYPES as readonly string[]).includes(String(t)),
  );
  return {
    ...base,
    types,
    lastNameRomaji: s(a.lastNameRomaji),
    firstNameRomaji: s(a.firstNameRomaji),
    middleNameRomaji: s(a.middleNameRomaji),
    lastNameKanji: s(a.lastNameKanji),
    firstNameKanji: s(a.firstNameKanji),
    lastNameKana: s(a.lastNameKana),
    firstNameKana: s(a.firstNameKana),
    nameAtAis: s(a.nameAtAis),
    dateOfBirth: s(a.dateOfBirth),
    gender: s(a.gender),
    locale: a.locale === "en" ? "en" : a.locale === "ja" ? "ja" : locale,
    student: {
      cohortNumber: s(st.cohortNumber),
      joinedYear: s(st.joinedYear),
      leftYear: s(st.leftYear),
      studentIdNo: s(st.studentIdNo),
      homeroomTeacher: s(st.homeroomTeacher),
      classmates: [classmates[0] ?? "", classmates[1] ?? ""],
    },
    parent: {
      children: children.length
        ? children.map((c) => ({
            ...emptyChild(c.mode === "existing" ? "existing" : "new"),
            existingUserId: s(c.existingUserId),
            name: s(c.name),
            // Older answers had only a name: start the new form from it.
            lastNameKanji: s(c.lastNameKanji) || (c.mode ? "" : s(c.name)),
            lastNameRomaji: s(c.lastNameRomaji),
            firstNameRomaji: s(c.firstNameRomaji),
            firstNameKanji: s(c.firstNameKanji),
            lastNameKana: s(c.lastNameKana),
            firstNameKana: s(c.firstNameKana),
            dateOfBirth: s(c.dateOfBirth),
            cohortNumber: s(c.cohortNumber),
            joinedYear: s(c.joinedYear),
            leftYear: s(c.leftYear),
            studentIdNo: s(c.studentIdNo),
          }))
        : base.parent.children,
    },
    teacher: {
      joinedYear: s(tc.joinedYear),
      leftYear: s(tc.leftYear),
      subjects: s(tc.subjects),
      schoolEmail: s(tc.schoolEmail),
    },
    evidence,
    diplomaUnavailable: a.diplomaUnavailable === true,
  };
}

// ---------------------------------------------------------------------------
// Errors and steps

/** Flatten Zod issues into { "student.leftYear": "yearsOrder" } (first wins). */
export function issuesToErrors(
  issues: readonly z.core.$ZodIssue[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join(".") || "_form";
    if (!(path in out)) out[path] = normalizeMessage(issue.message);
  }
  return out;
}

const KNOWN_CODES = new Set([
  "required",
  "tooLong",
  "invalidYear",
  "invalidDate",
  "invalidEmail",
  "yearsOrder",
  "typesRequired",
  "cohortRequired",
  "childrenRequired",
  "childNotSelected",
  "kanaOnly",
  "kanaRequired",
  "diplomaRequired",
  "tooManyFiles",
  "genderRequired",
  "schoolEmailDomain",
  "schoolEmailRequired",
  "schoolEmailUnverified",
  "schoolEmailTaken",
]);

function normalizeMessage(message: string): string {
  return KNOWN_CODES.has(message) ? message : "invalid";
}

/** Wizard steps: who you are → about you → details → review & send. */
export const STEPS = ["type", "basics", "details", "review"] as const;
export type Step = (typeof STEPS)[number];

export function stepOfPath(path: string): Step {
  const head = path.split(".")[0];
  if (head === "types") return "type";
  if (head === "student" || head === "parent" || head === "teacher")
    return "details";
  if (head === "evidence" || head === "diploma") return "review";
  return "basics";
}
