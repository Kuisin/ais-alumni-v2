/**
 * Registration for accounts that aren't approved yet (the website's
 * /app/onboarding/*), the handover link and お問い合わせ. Pure types only
 * (see core.ts): change additively.
 */

type IsoDate = string;

/** Which onboarding screen the account is on (from /me's onboardingPath). */
export type OnboardingStep = "email" | "line" | "verify" | "status";

// ---- POST /onboarding/email/request, /onboarding/email/verify ----

/** The email-code errors (auth.otp.errors.<code>). */
export type OtpError =
  | "invalid_email"
  | "invalid_code_format"
  | "rate_limited"
  | "send_failed"
  | "invalid"
  | "expired"
  | "too_many_attempts"
  | "generic";

export type EmailCodeSent = {
  /** "rate_limited": a code was sent recently — enter that one */
  notice: "sent" | "resent" | "rate_limited";
  email: string;
};

// ---- GET /onboarding/line ----

/** The LINE step and the status page's LINE card (the website's LineLinkPanel). */
export type OnboardingLine = {
  /** LINE Login is set up on this server */
  ready: boolean;
  linked: boolean;
  following: boolean;
  displayName: string | null;
  /** the Official Account's add-friend link, if configured */
  addFriendUrl: string | null;
};

// ---- GET /onboarding/status ----

export type ChildWaitState =
  | "approved"
  | "rejected"
  | "review"
  | "needsConfirm";

export type OnboardingStatus = {
  state: "PENDING_REVIEW" | "REJECTED" | "DEACTIVATED";
  /** a parent-only application waits for the children's approval */
  parentWaiting: boolean;
  children: { id: string; name: string; state: ChildWaitState }[];
  submittedAt: IsoDate | null;
  /** REJECTED only */
  decidedAt: IsoDate | null;
  /** REJECTED only: the committee's note */
  reviewNote: string | null;
  /** DEACTIVATED only */
  deactivatedAt: IsoDate | null;
  /** PENDING_REVIEW only: 「はじめの設定」 (same shape as the home screen's) */
  setup: {
    items: {
      key: string;
      done: boolean;
      href: string | null;
      optional: boolean;
      recommended: boolean;
    }[];
    done: number;
    total: number;
    complete: boolean;
  } | null;
  /** PENDING_REVIEW and not yet linked + following: offer LINE */
  line: OnboardingLine | null;
};

// ---- GET /onboarding/verify ----

export type CohortChoice = { value: string; label: string; graduated: boolean };

/**
 * The application form (first submission or NEEDS_INFO resubmission).
 * `initial` is the website's VerifyFormState (src/server/lib/verification/
 * schema.ts), prefilled from an earlier submission, the account and an
 * invitation.
 */
export type VerifyForm = {
  userId: string;
  needsInfo: boolean;
  /** NEEDS_INFO: what the committee asked for */
  reviewNote: string | null;
  initial: Record<string, unknown>;
  cohorts: CohortChoice[];
  /** teachers: an @aisnagoya.net address already confirmed */
  verifiedSchoolEmail: string | null;
};

/** POST /onboarding/verify — errors: 400 with the website's codes. */
export type VerifySubmitError = {
  error: "validation" | "forbidden" | "generic" | "evidence";
  /** form path → verify.errors.<code> */
  errors?: Record<string, string>;
};

/** POST /onboarding/verify/evidence (multipart: file, kind) */
export type EvidenceUploaded = {
  item: {
    kind: "DIPLOMA" | "OTHER";
    key: string;
    fileName: string;
    mimeType: "image/jpeg" | "image/png" | "application/pdf";
    size: number;
  };
};

/** POST /onboarding/verify/school-email/{send,confirm}: error codes are verify.schoolEmail.errors.<code> */
export type SchoolEmailResult = { ok: true };

/** POST /onboarding/verify/children/search */
export type RegisteredChild = {
  id: string;
  name: string;
  cohort: string | null;
};

// ---- /handover/[token] (public) ----

export type HandoverInfo =
  | { valid: false }
  | { valid: true; parent: string; child: string; email: string };

export type HandoverClaimed = { email: string; merged: boolean };

// ---- /support (public; signed-in members get their details filled in) ----

export type SupportDefaults = { name: string; email: string };

export type SupportSent = { ref: string };

/** 400 { error: "check", fieldErrors } — messages already translated. */
export type SupportFieldErrors = Partial<
  Record<"name" | "email" | "type" | "topic" | "subject" | "message", string>
>;
