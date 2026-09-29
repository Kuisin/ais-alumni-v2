/**
 * マイページ (the member's own profile — the website's /app/profile) and
 * 設定 (/app/settings) in the native app. Pure types only (see core.ts):
 * change additively.
 */

/** ISO 8601 timestamp. */
type IsoDate = string;
/** A calendar day, "YYYY-MM-DD" (birth dates). */
type Day = string;
type Language = "ja" | "en";

// ---- GET /profile — my profile (editing: profile.ts) ----

/**
 * 「公開範囲」: the smallest audience that sees a field (family see what
 * followers see, followers what members see); "self" = only you and the
 * committee. Same rules as src/lib/profile-visibility.ts.
 */
export type Reach = "members" | "followers" | "family" | "self";

export type ProfileRoleKey =
  | "TEACHER"
  | "CURRENT_STUDENT"
  | "CURRENT_PARENT"
  | "FORMER_STUDENT"
  | "FORMER_PARENT";

/** One role as in the website's AIS在籍記録, in the member's language. */
export type ProfileRole = {
  role: ProfileRoleKey;
  /** 卒業生 / 元在校生（未卒業） / 教職員 … */
  label: string;
  /** e.g. ["第4期", "2014年卒業", "高校（10〜12年）"]; empty = 詳細なし */
  facts: string[];
  /** teachers: 担当科目 */
  subjects: string | null;
};

/**
 * The latest request to change a locked field (name, birth date, gender).
 * Withdrawn (CANCELLED) ones are left out, as on the website.
 */
export type ChangeRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: IsoDate;
  /** the committee's note */
  reviewNote: string | null;
};

export type SocialKey = "instagram" | "linkedin" | "facebook" | "x" | "website";

/** Personal fields (private tier) a member may also show to followers. */
export type PersonalField =
  | "email"
  | "phone"
  | "lineDisplayName"
  | SocialKey
  | "currentStageDetail";

export type HistoryEducation = {
  id: string;
  school: string;
  /** EducationLevel — history.levels.<level> */
  level: string;
  field: string | null;
  startYear: number | null;
  endYear: number | null;
  /** no end year, or it ends this year or later (shown as 「現在」) */
  ongoing: boolean;
  reach: Reach;
};

export type HistoryWork = {
  id: string;
  company: string;
  title: string | null;
  /** 業種 / 職種, already in the member's language */
  industry: string | null;
  jobType: string | null;
  startYear: number | null;
  endYear: number | null;
  ongoing: boolean;
  reach: Reach;
};

export type MyProfile = {
  id: string;
  /** displayName(): romaji, else kanji */
  name: string;
  /** kanji（kana） */
  otherName: string | null;
  nameAtAis: string | null;
  /** their photo (always visible to themselves) or the default icon */
  avatar: string;
  /** in the website's order (卒業生, 在校生, 教職員, 保護者) */
  roles: ProfileRole[];
  /** accepted follows, and follow requests waiting for me */
  follows: { followers: number; following: number; requests: number };
  about: {
    bio: string | null;
    phone: string | null;
    phoneReach: Reach;
    /** only the links that are set */
    social: { key: SocialKey; url: string; reach: Reach }[];
    /** former students only (null otherwise): auto-accept same-year follows */
    autoAcceptSameYear: boolean | null;
  };
  /** parents only (null otherwise): listed in the member directory */
  directoryListed: boolean | null;
  photo: { public: boolean; reach: Reach };
  /** personal fields also shown to followers, in the website's order */
  sharedWithFollowers: PersonalField[];
  /** current first, then most recent */
  history: { education: HistoryEducation[]; work: HistoryWork[] };
  /** former students only (null otherwise): 現在の状況, from the history */
  currentStage: {
    /** LifeStage — roles.stage.<stage>; null = not known yet */
    stage: string | null;
    detail: string | null;
    detailReach: Reach;
  } | null;
  names: {
    romaji: string | null;
    kanji: string | null;
    kana: string | null;
    nameAtAis: string | null;
    request: ChangeRequest | null;
    /** the name parts, as the name change form starts with them */
    parts?: {
      lastNameRomaji: string;
      firstNameRomaji: string;
      middleNameRomaji: string;
      lastNameKanji: string;
      firstNameKanji: string;
      lastNameKana: string;
      firstNameKana: string;
    };
  };
  birthDate: {
    value: Day | null;
    request: (ChangeRequest & { proposed: Day }) | null;
  };
  gender: {
    /** null = not given yet (can be set once: POST /profile/gender) */
    value: "MALE" | "FEMALE" | "OTHER" | null;
    /** proposed: MALE | FEMALE | OTHER */
    request: (ChangeRequest & { proposed: string }) | null;
  };
  account: {
    email: string | null;
    emailReach: Reach;
    lineDisplayName: string | null;
    lineReach: Reach;
  };
};

// ---- GET /settings ----

export type NotifyVia = "AUTO" | "EMAIL_ONLY";
/** "PUSH" (a phone signed in to the app with notifications on) | "LINE" |
 *  "EMAIL" | "NONE" (none of them set up) */
export type NotifyRoute = "PUSH" | "LINE" | "EMAIL" | "NONE";
export type StaffArea = "admin" | "broadcast" | "teachers" | "news";

export type MySettings = {
  locale: Language;
  email: string | null;
  notify: {
    /** the member's choice (設定 → 通知) */
    via: NotifyVia;
    /** where news and mentions go right now (the app, else chooseChannel) */
    route: NotifyRoute;
    /**
     * Every category, in the website's order (notifications.categories.<key>).
     * `locked` ones (account) can't be turned off. Send the keys from this
     * list back — including ones this app version doesn't know.
     */
    categories: { key: string; on: boolean; locked: boolean }[];
  };
  line: {
    linked: boolean;
    /** follows the Official Account (needed for LINE notifications) */
    following: boolean;
    displayName: string | null;
    /** add-friend link for the Official Account, if configured */
    addFriendUrl: string | null;
    /** LINE linking is set up on this server */
    linkReady: boolean;
  };
  /** 管理モード: what this member can do there (empty = no admin mode) */
  adminMode: StaffArea[];
  /** teachers only (null otherwise): their school (work) email */
  schoolEmail: { email: string | null; verified: boolean } | null;
  /** ログイン方法: the email code, then Google and LINE */
  signInMethods?: SignInMethodRow[];
};

export type SignInMethodRow = {
  method: "email" | "google" | "line";
  linked: boolean;
  /** linked, and not the last way to sign in (email can't be removed) */
  removable: boolean;
  /** set up on this server (else 準備中) */
  ready: boolean;
  /**
   * can be added in the app (LINE: 設定 → LINE). Google can only be added
   * on the website for now (settings.methods.googleInApp).
   */
  addable: boolean;
};

// ---- 設定 forms. Messages are already in the member's language. ----

/** The result of a settings form (the website's SettingsFormState). */
export type SettingsResult = { ok?: boolean; message?: string; error?: string };

/**
 * DELETE /settings/sign-in/{google|line} → SettingsResult (then refetch
 * /settings; removing LINE also stops LINE notifications).
 */

/**
 * POST /settings/email → EmailChangeState: "send" a code to `email`,
 * "resend" it, or "verify" `code` for `email`. Changed when ok.
 */
export type EmailChangeRequest = {
  intent: "send" | "resend" | "verify";
  email: string;
  code?: string;
};
export type EmailChangeState = SettingsResult & {
  step: "email" | "code";
  email?: string;
};

/**
 * Teachers' school email: POST /settings/school-email { email } sends a
 * code; POST /settings/school-email/verify { email, code } saves it.
 * error → verify.schoolEmail.errors.<error>.
 */
export type SchoolEmailResult = {
  ok: boolean;
  error?:
    | "forbidden"
    | "invalidEmail"
    | "wrongDomain"
    | "taken"
    | "rateLimited"
    | "sendFailed"
    | "invalid"
    | "expired"
    | "tooManyAttempts";
};

/**
 * POST /settings/deactivate { confirm: "yes" } and POST /settings/delete
 * { confirmWord } → SettingsResult. When ok, this device is signed out
 * (the token no longer works): forget it and go to sign-in.
 */
export type DeactivateRequest = { confirm: "yes" };
export type DeleteAccountRequest = { confirmWord: string };

/**
 * GET /me/export: the member's data as a JSON file (the website's
 * /api/me/export), for any signed-in account.
 */

/** PUT /settings/language → MySettings. Then refetch /me: the app's language follows it. */
export type LanguageUpdate = { locale: Language };

/**
 * PATCH /settings/notifications → MySettings. `on`: every category to
 * receive (the rest of the optional ones are turned off; account notices
 * always come).
 */
export type NotifyUpdate = { via?: NotifyVia; on?: string[] };

// ---- /settings/devices — signed-in devices (native app sessions) ----

export type SignedInDevice = {
  id: string;
  /** "ios" | "android" | "web" | … (null = unknown) */
  platform: string | null;
  /** e.g. "iPhone 16" */
  deviceName: string | null;
  createdAt: IsoDate;
  /** refreshed about once a day */
  lastUsedAt: IsoDate;
  /** the device making this request */
  current: boolean;
};

/** GET /settings/devices: current device first, then most recently used. */
export type DeviceList = { devices: SignedInDevice[] };

/**
 * DELETE /settings/devices/{id} → { ok: true } — signs that device out.
 * errors: not_found (404, also someone else's), current_device (400: use
 * POST /auth/signout for this one).
 * DELETE /settings/devices → { removed: number } — every other device.
 */
export type DeviceSignOutResult = { ok: true };
export type OtherDevicesSignOutResult = { removed: number };
