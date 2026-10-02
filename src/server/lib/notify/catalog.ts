/**
 * Every notification the app sends, in one place (texts: messages/<locale>/
 * notifications.json → kinds.<KIND>).
 *
 * Message rules (all kinds):
 *  - title: short, what happened (≤ ~20 chars in Japanese). No brand prefix
 *    on LINE (the official account name shows); email subjects get
 *    「【AIS同窓会】」.
 *  - body: one sentence, who / what — never private content (message text,
 *    post bodies, committee notes). LINE shows only title + body + link.
 *  - email: the same, plus `detail` (what to do next) and the committee
 *    note if any, in a branded wrapper with a button and a footer saying
 *    why it was sent and where to change settings.
 *  - link: always a short /n/<member code>/<token> link (see links.ts), never a direct
 *    app URL.
 *
 * Categories let members turn groups of notifications off (Settings);
 * `account` (application result, security, account status, results of
 * their own requests) can't be turned off.
 *
 * Members who turned on notifications in the app (src/lib/push) get every
 * kind there instead of LINE / email (src/lib/notify/route.ts); `alwaysEmail`
 * kinds — and anything carrying a committee note — also go by email.
 */

export const NOTIFY_CATEGORIES = [
  "account",
  "news",
  "events",
  "chat",
  "social",
  "family",
  "profile",
  "admin",
] as const;
export type NotifyCategory = (typeof NOTIFY_CATEGORIES)[number];

/** Categories members may turn off. */
export const OPTIONAL_CATEGORIES: readonly NotifyCategory[] =
  NOTIFY_CATEGORIES.filter((c) => c !== "account");

type KindSpec = {
  category: NotifyCategory;
  emoji: string;
  /**
   * May go by LINE (for members who get notifications there): what needs
   * the member personally — unread 1:1 chat / @mention notices (5 minutes
   * unread, once per streak), what the committee decides or asks about
   * their own account (application result / more information, results of
   * name, birth date, gender and record requests), and for staff the admin
   * tasks (applications and requests to review, posts to approve).
   * Bulk mail — ニュース, reminders, unread summaries — is email, so LINE's
   * monthly message allowance lasts (LINE falls back to email when it's
   * used up).
   */
  line?: true;
  /** Also by email for members who get notifications in the app. */
  alwaysEmail?: true;
};

export const NOTIFY_KINDS = {
  // Account — always sent
  VERIFICATION_APPROVED: {
    category: "account",
    emoji: "🎉",
    line: true,
    alwaysEmail: true,
  },
  VERIFICATION_REJECTED: {
    category: "account",
    emoji: "📋",
    line: true,
    alwaysEmail: true,
  },
  VERIFICATION_NEEDS_INFO: {
    category: "account",
    emoji: "📝",
    line: true,
    alwaysEmail: true,
  },
  SECURITY_METHOD_ADDED: {
    category: "account",
    emoji: "🔐",
    alwaysEmail: true,
  },
  SECURITY_METHOD_REMOVED: {
    category: "account",
    emoji: "🔐",
    alwaysEmail: true,
  },
  ACCOUNT_DEACTIVATED_SELF: {
    category: "account",
    emoji: "👋",
    alwaysEmail: true,
  },
  ACCOUNT_DEACTIVATED: { category: "account", emoji: "⏸️", alwaysEmail: true },
  ACCOUNT_REACTIVATED: { category: "account", emoji: "▶️" },
  NAME_REQUEST_APPROVED: { category: "account", emoji: "✅", line: true },
  NAME_REQUEST_REJECTED: { category: "account", emoji: "📋", line: true },
  BIRTH_DATE_REQUEST_APPROVED: { category: "account", emoji: "✅", line: true },
  BIRTH_DATE_REQUEST_REJECTED: { category: "account", emoji: "📋", line: true },
  GENDER_REQUEST_APPROVED: { category: "account", emoji: "✅", line: true },
  GENDER_REQUEST_REJECTED: { category: "account", emoji: "📋", line: true },
  RECORD_REQUEST_APPROVED: { category: "account", emoji: "✅", line: true },
  RECORD_REQUEST_REJECTED: { category: "account", emoji: "📋", line: true },
  // News
  NEWS: { category: "news", emoji: "📰" },
  NEWS_REMINDER: { category: "news", emoji: "⏰" },
  BROADCAST: { category: "news", emoji: "✉️" },
  // Events
  EVENT_REMINDER_7D: { category: "events", emoji: "📅" },
  EVENT_REMINDER_1D: { category: "events", emoji: "📅" },
  // Chat
  // LINE (or email): 1:1 messages / mentions still unread after 5 minutes,
  // once per unread streak — few pushes, but people hear about them.
  // In the app they're pushed right away instead (src/lib/push/chat.ts).
  CHAT_DIRECT: { category: "chat", emoji: "💬", line: true },
  CHAT_MENTION: { category: "chat", emoji: "💬", line: true },
  CHAT_DIGEST: { category: "chat", emoji: "💬" },
  // App only: every message in a group the member chose to follow closely.
  CHAT_GROUP: { category: "chat", emoji: "💬" },
  // Follows & vouching
  FOLLOW_REQUEST: { category: "social", emoji: "👤" },
  FOLLOW_AUTO_ACCEPTED: { category: "social", emoji: "👤" },
  FOLLOW_ACCEPTED: { category: "social", emoji: "🤝" },
  VOUCH_REQUEST: { category: "social", emoji: "🙋" },
  // Family
  FAMILY_LINK_REQUEST_AS_CHILD: { category: "family", emoji: "👨‍👩‍👧" },
  FAMILY_LINK_REQUEST_AS_PARENT: { category: "family", emoji: "👨‍👩‍👧" },
  FAMILY_HANDOVER_DONE: { category: "family", emoji: "🔑" },
  // Profile
  STAGE_PROMPT: { category: "profile", emoji: "🎓" },
  // Admin work: sent the moment it happens (src/lib/notify/staff.ts), and
  // always by email too, so it reaches committee members at their desk even
  // when they use the app.
  VERIFICATION_SUBMITTED_ADMIN: {
    category: "admin",
    emoji: "🆕",
    line: true,
    alwaysEmail: true,
  },
  NEWS_APPROVAL_ADMIN: {
    category: "admin",
    emoji: "📰",
    line: true,
    alwaysEmail: true,
  },
  EVENT_APPROVAL_ADMIN: {
    category: "admin",
    emoji: "📅",
    line: true,
    alwaysEmail: true,
  },
  NAME_REQUEST_ADMIN: {
    category: "admin",
    emoji: "🗂️",
    line: true,
    alwaysEmail: true,
  },
  BIRTH_DATE_REQUEST_ADMIN: {
    category: "admin",
    emoji: "🗂️",
    line: true,
    alwaysEmail: true,
  },
  GENDER_REQUEST_ADMIN: {
    category: "admin",
    emoji: "🗂️",
    line: true,
    alwaysEmail: true,
  },
  RECORD_REQUEST_ADMIN: {
    category: "admin",
    emoji: "🗂️",
    line: true,
    alwaysEmail: true,
  },
} as const satisfies Record<string, KindSpec>;

export type NotifyKind = keyof typeof NOTIFY_KINDS;

export function kindSpec(kind: NotifyKind): KindSpec {
  return NOTIFY_KINDS[kind];
}

/** Whether a member with these turned-off categories gets this kind. */
export function wantsKind(
  notifyOff: readonly string[] | null | undefined,
  kind: NotifyKind,
): boolean {
  const { category } = NOTIFY_KINDS[kind];
  return category === "account" || !(notifyOff ?? []).includes(category);
}
