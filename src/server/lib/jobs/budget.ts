/**
 * Time limits for work that must fit in one function call (Vercel stops a
 * call at 300 s — maxDuration on /api/cron). Work stops starting new pieces
 * after the budget and carries on in the next call; a claim (lease) lasts
 * longer than any call, so if a call is killed its claim runs out and the
 * next call takes the work over.
 */
export const TIME_BUDGET_MS = 240_000;
export const LEASE_MS = 330_000;

/** When work started now has to stop starting new pieces (ms timestamp). */
export function deadlineFrom(start: number = Date.now()): number {
  return start + TIME_BUDGET_MS;
}

export function leaseUntil(from: number = Date.now()): Date {
  return new Date(from + LEASE_MS);
}
