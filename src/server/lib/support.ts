/**
 * お問い合わせ (support): four kinds, each with its topics (the form's
 * two-level dropdown). Texts: messages/<locale>/support.json →
 * types.<TYPE>.label / types.<TYPE>.topics.<TOPIC>.
 */
export const SUPPORT_TYPES = {
  ISSUE: [
    "SIGN_IN",
    "REGISTRATION",
    "NOTIFICATIONS",
    "CHAT",
    "DISPLAY",
    "OTHER",
  ],
  QUESTION: ["REGISTRATION", "PROFILE", "EVENTS", "FAMILY", "PRIVACY", "OTHER"],
  COMPLAINT: ["MEMBER_CONDUCT", "CONTENT", "OPERATIONS", "PRIVACY", "OTHER"],
  FEATURE: ["NEW_FEATURE", "IMPROVEMENT", "USABILITY", "LANGUAGE", "OTHER"],
} as const satisfies Record<string, readonly string[]>;

export type SupportType = keyof typeof SUPPORT_TYPES;
export const SUPPORT_TYPE_KEYS = Object.keys(SUPPORT_TYPES) as SupportType[];

export function isSupportTopic(type: string, topic: string): boolean {
  return (
    type in SUPPORT_TYPES &&
    (SUPPORT_TYPES[type as SupportType] as readonly string[]).includes(topic)
  );
}

export const SUPPORT_LIMITS = {
  name: 100,
  email: 254,
  subject: 120,
  message: 5000,
  /** requests per email (or member) per hour */
  perHour: 3,
} as const;

/** Short reference shown to the sender and in emails (last 6 of the id). */
export function supportRef(id: string): string {
  return id.slice(-6).toUpperCase();
}
