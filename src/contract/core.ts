/**
 * The native app's API contract (/api/mobile/v1/*), shared as types by the
 * server (src/lib/mobile, src/app/api/mobile) and the app (mobile/, via the
 * `@contract/*` path). Pure types only: no imports, nothing at runtime.
 *
 * Compatibility: installed apps update slowly, so change this contract
 * additively — new optional fields, new endpoints. Anything else needs a
 * new version prefix (/api/mobile/v2).
 *
 * Conventions: dates are ISO 8601 strings; URLs may be site-relative
 * ("/api/files?…", "/avatars/…") and are resolved against the API origin
 * by the app; user-facing text the server can't avoid composing (sender
 * labels, localized post titles…) is already in the member's language.
 */

export type Locale = "ja" | "en";
/** ISO 8601 timestamp. */
export type IsoDate = string;

/** Every non-2xx response. `error` is a stable machine-readable code. */
export type ApiErrorBody = { error: string; [extra: string]: unknown };

export type AccountState =
  | "UNVERIFIED_EMAIL"
  | "EMAIL_VERIFIED"
  | "PENDING_REVIEW"
  | "NEEDS_INFO"
  | "ACTIVE"
  | "REJECTED"
  | "DEACTIVATED";

/** Another member as shown in lists (photo already visibility-checked). */
export type MemberRef = {
  id: string;
  /** displayName(): the romaji name, else kanji */
  name: string;
  /** kanji（kana）when there's room for a second line */
  otherName: string | null;
  /** photo or the default icon for their gender */
  avatar: string;
};

export type StaffAccess = {
  admin: boolean;
  broadcast: boolean;
  teachers: boolean;
  news: boolean;
};

export type Device = {
  /** "ios" | "android" | "web" */
  platform?: string;
  /** e.g. "iPhone 16" */
  deviceName?: string;
};

// ---- GET /config (public) ----

export type AppConfig = {
  /** social sign-ins that are set up on this server */
  sso: { google: boolean; line: boolean };
  /** LINE Official Account id for the add-friend link, e.g. "@123abcde" */
  lineOaId: string | null;
  /** app versions below this should ask the member to update (none yet) */
  minAppVersion: string | null;
  /** where to update the app (App Store / Google Play), when known */
  storeUrl?: { ios: string | null; android: string | null };
};

// ---- GET /me (any signed-in account) ----

export type Me = {
  user: {
    id: string;
    state: AccountState;
    locale: Locale;
    isAdmin: boolean;
    name: string;
    otherName: string | null;
    email: string | null;
    avatar: string;
    lineLinked: boolean;
  };
  /**
   * Non-ACTIVE accounts: the website screen for their state (onboarding,
   * application status), opened in the app's web view. Null when ACTIVE.
   */
  onboardingPath: string | null;
  /** admin-mode sections (website) this member may use */
  access: StaffAccess;
  /** counts for the tab bar; inbox = unread in the notification list */
  badges: {
    news: number;
    messages: number;
    chat: number;
    follows: number;
    inbox: number;
  };
  /** Supabase Realtime (signal-only broadcast channels); null = poll */
  realtime: { url: string; key: string; topics: string[] } | null;
  features: { messages: boolean };
};

// ---- Sign-in ----

/** POST /auth/email/request */
export type EmailCodeRequest = { email: string; locale: Locale };
export type EmailCodeResult =
  | { ok: true; notice: "sent" }
  /** a code was sent less than 30 s ago (or 5 in the last hour): enter it */
  | { ok: true; notice: "rate_limited" };
// errors: invalid_email (400), send_failed (502)

/** POST /auth/email/verify */
export type EmailVerifyRequest = {
  email: string;
  code: string;
  locale: Locale;
  device?: Device;
};
// errors: invalid_code_format, invalid, expired, too_many_attempts (400)

/** POST /auth/oauth/exchange — the code from aisalumni://auth?code=… */
export type OAuthExchangeRequest = {
  code: string;
  verifier: string;
  device?: Device;
};
// errors: invalid_code (400)

/** Result of every sign-in: keep `token` in the keychain. */
export type SessionResult = { token: string; me: Me };
