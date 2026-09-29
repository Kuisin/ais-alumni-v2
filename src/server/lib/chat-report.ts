/**
 * Reports about a chat or someone in it (chat details → 報告する). Texts:
 * messages/<locale>/chat.json → report.reasons.<REASON>.
 */
export const CHAT_REPORT_REASONS = [
  "HARASSMENT",
  "SPAM",
  "INAPPROPRIATE",
  "IMPERSONATION",
  "PRIVACY",
  "OTHER",
] as const;

export type ChatReportReason = (typeof CHAT_REPORT_REASONS)[number];

export function isChatReportReason(v: string): v is ChatReportReason {
  return (CHAT_REPORT_REASONS as readonly string[]).includes(v);
}

export const CHAT_REPORT_LIMITS = {
  detail: 2000,
  /** reports per member per hour */
  perHour: 5,
  /** recent messages attached for admins */
  snapshot: 20,
} as const;

/** A message attached to a report (admins can't open 1:1 talks). */
export type ChatReportMessage = {
  id: string;
  userId: string;
  name: string;
  body: string;
  createdAt: string;
};
