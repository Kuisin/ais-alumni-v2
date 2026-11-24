// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { z } from "zod";
import { AccountState, RoleKey } from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import { calendarYear } from "@/server/lib/school";
import { AuthError, actionTeacherRegistrar } from "@/server/lib/session";
import { syncMemberStatus } from "@/server/lib/status-sync";

const idSchema = z.string().min(1).max(64);

/**
 * 教職員登録担当 / admin: make a member a current teacher (現職). Adds the
 * 教職員 role, or clears the leave year of an existing one. A 教職員登録担当
 * can't make themselves one (being a current teacher opens minors' profiles
 * and wider posting) — only an admin can — and nobody can make a current
 * student one.
 */
export async function assignTeacherAction(fd: FormData): Promise<void> {
  const actor = await actionTeacherRegistrar();
  const userId = idSchema.parse(fd.get("userId"));
  if (userId === actor.id && !actor.isAdmin) throw new AuthError("forbidden");
  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      state: true,
      roles: {
        where: { role: RoleKey.CURRENT_STUDENT },
        select: { id: true },
      },
    },
  });
  if (target?.state !== AccountState.ACTIVE) return;
  if (target.roles.length) throw new AuthError("forbidden");
  await db.$transaction(async (tx) => {
    await tx.userRole.upsert({
      where: { userId_role: { userId, role: RoleKey.TEACHER } },
      create: { userId, role: RoleKey.TEACHER, yearsTo: null },
      update: { yearsTo: null },
    });
    await syncMemberStatus(userId, tx);
  });
  await audit(actor.id, "teacher.assigned", { type: "User", id: userId });
  refresh();
}

/**
 * 教職員登録担当 / admin: move a current teacher to former (元教職員) by
 * setting this year as their leave year. Their record stays.
 */
export async function unassignTeacherAction(fd: FormData): Promise<void> {
  const actor = await actionTeacherRegistrar();
  const userId = idSchema.parse(fd.get("userId"));
  const year = calendarYear();
  await db.$transaction(async (tx) => {
    const role = await tx.userRole.findUnique({
      where: { userId_role: { userId, role: RoleKey.TEACHER } },
      select: { yearsFrom: true },
    });
    if (!role) return;
    await tx.userRole.update({
      where: { userId_role: { userId, role: RoleKey.TEACHER } },
      // Keep the leave year on or after the join year.
      data: { yearsTo: Math.max(year, role.yearsFrom ?? year) },
    });
    await syncMemberStatus(userId, tx);
  });
  await audit(actor.id, "teacher.unassigned", { type: "User", id: userId });
  refresh();
}
