import type { Prisma } from "@/server/generated/prisma/client";

/**
 * 同窓会委員 approval, shared by ニュース posts and events: a row with
 * approvalRequired is hidden from members (and never notified) until another
 * 同窓会委員 or an admin sets approvedAt.
 */
export function awaitingApproval(row: {
  approvalRequired: boolean;
  approvedAt: Date | null;
}): boolean {
  return row.approvalRequired && !row.approvedAt;
}

export const eventApprovedWhere: Prisma.EventWhereInput = {
  OR: [{ approvalRequired: false }, { approvedAt: { not: null } }],
};
