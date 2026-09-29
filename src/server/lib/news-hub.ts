import { z } from "zod";

/**
 * ニュース as the members' hub: 「確認しました」, a poll, 日程調整 (○△×),
 * comments, reactions and attachments on a post, with a deadline and one
 * reminder to those who haven't answered. Pure helpers (unit-tested); the
 * database side is in news-hub-db.ts.
 */

export const REACTIONS = ["👍", "❤️", "🎉", "😂", "🙏", "👏"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const MAX_POLL_OPTIONS = 10;
export const MAX_SCHEDULE_OPTIONS = 20;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_ATTACHMENTS = 5;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export const ATTACHMENT_PREFIX = "news-files/";

/** Remind this long before the deadline. */
export const REMIND_BEFORE_MS = 24 * 60 * 60 * 1000;

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const optId = z.string().min(1).max(64).optional();

export const pollInputSchema = z.object({
  question: z.string().trim().min(1, "pollQuestion").max(300, "tooLong"),
  multiple: z.boolean().default(false),
  options: z
    .array(
      z.object({
        id: optId,
        label: z.string().trim().max(200, "tooLong"),
      }),
    )
    .transform((a) => a.filter((o) => o.label))
    .refine((a) => a.length >= 2, "pollOptions")
    .refine((a) => a.length <= MAX_POLL_OPTIONS, "pollOptions"),
});
export type PollInput = z.infer<typeof pollInputSchema>;

export const scheduleInputSchema = z.object({
  question: z.string().trim().max(300, "tooLong").default(""),
  options: z
    .array(
      z.object({
        id: optId,
        /** datetime-local, JST */
        startsAt: z.string().trim(),
        label: z.string().trim().max(100, "tooLong").default(""),
      }),
    )
    .transform((a) => a.filter((o) => o.startsAt))
    .refine(
      (a) => a.every((o) => DATETIME_LOCAL.test(o.startsAt)),
      "invalidDate",
    )
    .refine((a) => a.length >= 1, "scheduleOptions")
    .refine((a) => a.length <= MAX_SCHEDULE_OPTIONS, "scheduleOptions"),
});
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export const attachmentItemSchema = z.object({
  /** kept attachment */
  id: optId,
  /** newly uploaded object */
  key: z.string().max(500).optional(),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(ATTACHMENT_TYPES),
  size: z.number().int().positive().max(ATTACHMENT_MAX_BYTES),
});
export type AttachmentItem = z.infer<typeof attachmentItemSchema>;

export function isAttachmentKey(key: string): boolean {
  return (
    key.startsWith(ATTACHMENT_PREFIX) &&
    key.length > ATTACHMENT_PREFIX.length &&
    !key.includes("..") &&
    !key.includes("\\") &&
    key.length <= 500
  );
}

/** Parse a JSON form field with a schema; "" / "null" = not set. */
export function parseJsonField<T>(
  raw: string,
  schema: z.ZodType<T>,
): { ok: true; value: T | null } | { ok: false; error: string } {
  if (!raw || raw === "null") return { ok: true, value: null };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid" };
  }
  const r = schema.safeParse(json);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, error: r.error.issues[0]?.message ?? "invalid" };
}

export type Vote = "YES" | "MAYBE" | "NO";

/** Counts per option (and per answer for 日程調整). */
export function tally(
  optionIds: readonly string[],
  votes: readonly { optionId: string; answer: Vote }[],
): Map<string, Record<Vote, number>> {
  const out = new Map<string, Record<Vote, number>>();
  for (const id of optionIds) out.set(id, { YES: 0, MAYBE: 0, NO: 0 });
  for (const v of votes) {
    const row = out.get(v.optionId);
    if (row) row[v.answer]++;
  }
  return out;
}

/**
 * 日程調整: the best candidates — most ○, then fewest ×. Returns the ids of
 * the top ones (ties included), none if nobody answered ○.
 */
export function bestCandidates(
  counts: Map<string, Record<Vote, number>>,
): string[] {
  let best: string[] = [];
  let top: [number, number] | null = null;
  for (const [id, c] of counts) {
    if (c.YES === 0) continue;
    const score: [number, number] = [c.YES, -c.NO];
    if (
      !top ||
      score[0] > top[0] ||
      (score[0] === top[0] && score[1] > top[1])
    ) {
      top = score;
      best = [id];
    } else if (score[0] === top[0] && score[1] === top[1]) best.push(id);
  }
  return best;
}

/** What a member is asked to do on a post. */
export type Asks = {
  confirm: boolean;
  pollIds: readonly string[];
};

/** Whether the member has done everything the post asks. */
export function hasResponded(
  asks: Asks,
  done: { confirmed: boolean; votedPollIds: ReadonlySet<string> },
): boolean {
  if (asks.confirm && !done.confirmed) return false;
  return asks.pollIds.every((id) => done.votedPollIds.has(id));
}

export function asksAnything(asks: Asks): boolean {
  return asks.confirm || asks.pollIds.length > 0;
}

/** Answers can change until the deadline or until the sender closes them. */
export function isOpen(
  post: { deadline: Date | null; closedAt?: Date | null },
  now: Date = new Date(),
): boolean {
  if (post.closedAt) return false;
  return !post.deadline || post.deadline > now;
}

/** Posts whose reminder is due: deadline within REMIND_BEFORE_MS, not past. */
export function reminderDue(
  post: {
    deadline: Date | null;
    remindedAt: Date | null;
    closedAt?: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (!post.deadline || post.remindedAt || post.closedAt) return false;
  const left = post.deadline.getTime() - now.getTime();
  return left > 0 && left <= REMIND_BEFORE_MS;
}
