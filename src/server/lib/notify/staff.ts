import { AccountState, PositionKey } from "@/server/generated/prisma/enums";
import { isCurrentTeacher } from "@/server/lib/authz";
import { db } from "@/server/lib/db";
import { canApproveNews } from "@/server/lib/permissions";
import { NOTIFY_USER_SELECT, type NotifyUser } from "./index";

/**
 * Who gets the committee's work notifications (catalog category "admin",
 * sent right away and always by email as well).
 */

/** ACTIVE admins. */
export async function activeAdmins(): Promise<NotifyUser[]> {
  return db.user.findMany({
    where: { isAdmin: true, state: AccountState.ACTIVE },
    select: NOTIFY_USER_SELECT,
  });
}

/**
 * Who may approve a 同窓会委員's ニュース post or event (canApproveNews):
 * admins and 同窓会委員, never the author.
 */
export async function contentApprovers(
  authorId: string,
): Promise<NotifyUser[]> {
  const users = await db.user.findMany({
    where: {
      id: { not: authorId },
      state: AccountState.ACTIVE,
      OR: [
        { isAdmin: true },
        { positions: { some: { position: PositionKey.ALUMNI_COMMITTEE } } },
      ],
    },
    select: {
      ...NOTIFY_USER_SELECT,
      state: true,
      isAdmin: true,
      roles: { select: { role: true, teacherStatus: true } },
      positions: { select: { position: true, cohortId: true } },
    },
  });
  return users
    .filter((u) =>
      canApproveNews({
        state: u.state,
        isAdmin: u.isAdmin,
        roles: u.roles.map((r) => r.role),
        currentTeacher: isCurrentTeacher(u.roles),
        positions: u.positions,
      }),
    )
    .map(({ state: _s, isAdmin: _a, roles: _r, positions: _p, ...u }) => u);
}
