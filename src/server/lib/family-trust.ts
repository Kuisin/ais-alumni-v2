import type { Prisma } from "@/server/generated/prisma/client";

/**
 * Family links that count for access — the cohort chats, news aimed at a
 * class's parents, parent status (current / former): confirmed ones, and
 * those that were part of an application the committee reviewed. A link an
 * approved member claims later (FamilyLink.unreviewed) grants nothing until
 * the other side or an admin confirms it.
 */
export const trustedLinkWhere = {
  OR: [{ confirmedAt: { not: null } }, { unreviewed: false }],
} satisfies Prisma.FamilyLinkWhereInput;
