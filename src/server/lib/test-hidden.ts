import type { Prisma } from "@/server/generated/prisma/client";

/**
 * Test accounts (User.isTest, src/server/lib/test-accounts.ts) stay out of
 * what real members see and get: the directory and its count, member
 * searches and candidate lists, automatic group chats, statistics and bulk
 * sends. Kept apart from test-accounts.ts so list code can import it
 * without the account-deletion code.
 */

/**
 * Members a viewer may find in lists: test accounts only for admins and
 * other test accounts (so test accounts can find each other to try follows,
 * 1:1 talks and family links).
 */
export function hideTestAccounts(
  viewer?: { isAdmin: boolean; isTest?: boolean } | null,
): Prisma.UserWhereInput {
  return viewer && (viewer.isAdmin || viewer.isTest) ? {} : REAL_MEMBERS;
}

/** Real members only (bulk sends, counts, statistics). */
export const REAL_MEMBERS = { isTest: false } as const;

/**
 * Bulk-send recipients: real members, and test accounts only when picked
 * individually (a news post or event addressed to them by name).
 */
export function realOrPicked(
  userIds: readonly string[] = [],
): Prisma.UserWhereInput {
  return userIds.length
    ? { OR: [REAL_MEMBERS, { id: { in: [...userIds] } }] }
    : REAL_MEMBERS;
}
