// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { z } from "zod";
import {
  AccountState,
  PositionKey,
  RoleKey,
} from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { isCurrentTeacher } from "@/server/lib/authz";
import { syncChatMembership } from "@/server/lib/chat-db";
import { parseCohortNumber } from "@/server/lib/cohorts";
import { db } from "@/server/lib/db";
import { toKatakana } from "@/server/lib/names";
import { positionEligible } from "@/server/lib/permissions";
import { AuthError, actionAdmin } from "@/server/lib/session";

export type PositionFormState = { ok?: boolean; message?: string } | null;

const schema = z.object({
  userId: z.string().min(1).max(64),
  position: z.enum(PositionKey),
  grant: z.enum(["yes", "no"]),
  cohortNumber: z.string().trim(),
});

/** Admin: grant or remove a position (message = key in adminMembers.positions). */
export async function setMemberPositionAction(
  _prev: PositionFormState,
  fd: FormData,
): Promise<PositionFormState> {
  let admin: Awaited<ReturnType<typeof actionAdmin>>;
  try {
    admin = await actionAdmin();
  } catch (e) {
    if (e instanceof AuthError)
      return { ok: false, message: "errors.forbidden" };
    throw e;
  }
  const parsed = schema.safeParse({
    userId: fd.get("userId"),
    position: fd.get("position"),
    grant: fd.get("grant"),
    cohortNumber: String(fd.get("cohortNumber") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: "errors.invalid" };
  const { userId, position } = parsed.data;

  if (parsed.data.grant === "no") {
    await db.userPosition.deleteMany({ where: { userId, position } });
    await audit(
      admin.id,
      "member.position_removed",
      { type: "User", id: userId },
      { position },
    );
    await syncChatMembership(userId).catch(() => {}); // leaves 学年代表 chat
    refresh();
    return { ok: true, message: "removed" };
  }

  const roles = await db.userRole.findMany({
    where: { userId },
    select: { role: true, teacherStatus: true },
  });
  if (
    !positionEligible(
      position,
      roles.map((r) => r.role),
      isCurrentTeacher(roles),
    )
  ) {
    return { ok: false, message: "errors.notEligible" };
  }
  let cohortId: string | null = null;
  if (position === PositionKey.STUDENT_LEADER) {
    const n = parseCohortNumber(parsed.data.cohortNumber);
    if (n == null) return { ok: false, message: "errors.cohort" };
    // 学年代表 represent their own 学年 (as a student or graduate).
    const own = await db.userRole.findFirst({
      where: {
        userId,
        role: { in: [RoleKey.CURRENT_STUDENT, RoleKey.FORMER_STUDENT] },
        cohort: { number: n },
      },
      select: { cohortId: true },
    });
    if (!own?.cohortId) return { ok: false, message: "errors.ownCohort" };
    cohortId = own.cohortId;
  }
  await db.userPosition.upsert({
    where: { userId_position: { userId, position } },
    create: { userId, position, cohortId, grantedById: admin.id },
    update: { cohortId, grantedById: admin.id },
  });
  await audit(
    admin.id,
    "member.position_granted",
    { type: "User", id: userId },
    { position, cohortId },
  );
  await syncChatMembership(userId).catch(() => {}); // joins 学年代表 chat
  refresh();
  return { ok: true, message: "granted" };
}

const STUDENT_ROLES: RoleKey[] = [
  RoleKey.CURRENT_STUDENT,
  RoleKey.FORMER_STUDENT,
];

export type CohortStudent = { id: string; name: string; kanji: string | null };

/** Admin: students / graduates of a 学年 matching a name (to pick 学年代表). */
export async function searchCohortStudentsAction(
  cohortId: string,
  q: string,
): Promise<CohortStudent[]> {
  const admin = await actionAdmin().catch(() => null);
  const term = String(q ?? "")
    .trim()
    .slice(0, 60);
  if (!admin || !term || typeof cohortId !== "string") return [];
  const rows = await db.user.findMany({
    where: {
      state: AccountState.ACTIVE,
      managedById: null,
      roles: { some: { role: { in: STUDENT_ROLES }, cohortId } },
      OR: [
        { nameRomaji: { contains: term, mode: "insensitive" } },
        { nameKanji: { contains: term } },
        { nameKana: { contains: toKatakana(term) } },
      ],
    },
    orderBy: { nameRomaji: "asc" },
    take: 10,
    select: { id: true, nameRomaji: true, nameKanji: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.nameRomaji ?? r.nameKanji ?? "—",
    kanji: r.nameRomaji ? r.nameKanji : null,
  }));
}

/** Admin: make a student / graduate of this 学年 its 学年代表 (or remove). */
export async function setCohortRepAction(
  cohortId: string,
  userId: string,
  on: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const admin = await actionAdmin().catch(() => null);
  if (!admin || typeof cohortId !== "string" || typeof userId !== "string")
    return { ok: false, message: "errors.forbidden" };
  if (!on) {
    await db.userPosition.deleteMany({
      where: { userId, position: PositionKey.STUDENT_LEADER, cohortId },
    });
    await audit(
      admin.id,
      "member.position_removed",
      { type: "User", id: userId },
      { position: PositionKey.STUDENT_LEADER, cohortId },
    );
  } else {
    const member = await db.user.findFirst({
      where: {
        id: userId,
        state: AccountState.ACTIVE,
        roles: { some: { role: { in: STUDENT_ROLES }, cohortId } },
      },
      select: { id: true },
    });
    if (!member) return { ok: false, message: "errors.ownCohort" };
    // One 学年代表 position per member: moving them replaces their 学年.
    await db.userPosition.upsert({
      where: {
        userId_position: { userId, position: PositionKey.STUDENT_LEADER },
      },
      create: {
        userId,
        position: PositionKey.STUDENT_LEADER,
        cohortId,
        grantedById: admin.id,
      },
      update: { cohortId, grantedById: admin.id },
    });
    await audit(
      admin.id,
      "member.position_granted",
      { type: "User", id: userId },
      { position: PositionKey.STUDENT_LEADER, cohortId },
    );
  }
  await syncChatMembership(userId).catch(() => {}); // 学年代表 chat
  refresh();
  return { ok: true };
}
