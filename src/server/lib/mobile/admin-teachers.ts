import type { AdminTeachers } from "@contract/admin";
import {
  assignTeacherAction,
  unassignTeacherAction,
} from "@/server/app/actions/teachers";
import {
  AccountState,
  RoleKey,
  TeacherStatus,
} from "@/server/generated/prisma/enums";
import { getStaffAccess } from "@/server/lib/broadcasts";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { forbidden, type Locale } from "@/server/lib/mobile/http";
import type { CurrentUser } from "@/server/lib/session";

/**
 * 教職員 (the website's /app/admin/teachers): current teachers (現職), and
 * making members one or moving them to former. Admins and 教職員登録担当
 * (requireTeacherRegistrar); the website's actions check it again.
 */
async function teacherRegistrar(user: CurrentUser): Promise<void> {
  if (!(await getStaffAccess(user)).teachers) throw forbidden();
}

const PERSON = { id: true, nameRomaji: true, nameKanji: true } as const;

export async function adminTeachers(
  user: CurrentUser,
  rawQ: string,
  locale: Locale,
): Promise<AdminTeachers> {
  await teacherRegistrar(user);
  const q = rawQ.trim().slice(0, 60);
  const isCurrent = {
    role: RoleKey.TEACHER,
    NOT: { teacherStatus: TeacherStatus.FORMER },
  };
  const [current, results] = await Promise.all([
    db.user.findMany({
      where: { state: AccountState.ACTIVE, roles: { some: isCurrent } },
      select: {
        ...PERSON,
        roles: {
          where: { role: RoleKey.TEACHER },
          select: {
            yearsFrom: true,
            subjects: true,
            schoolEmail: true,
            schoolEmailVerified: true,
          },
        },
      },
      orderBy: { nameRomaji: "asc" },
    }),
    q
      ? db.user.findMany({
          where: {
            state: AccountState.ACTIVE,
            NOT: { roles: { some: isCurrent } },
            OR: [
              { nameRomaji: { contains: q, mode: "insensitive" } },
              { nameKanji: { contains: q } },
            ],
          },
          select: { ...PERSON, roles: { select: { role: true } } },
          take: 20,
          orderBy: { nameRomaji: "asc" },
        })
      : Promise.resolve([]),
  ]);
  return {
    q,
    current: current.map((u) => {
      const role = u.roles[0];
      return {
        id: u.id,
        name: displayName(u, locale),
        schoolEmail: role?.schoolEmail ?? null,
        schoolEmailVerified: Boolean(
          role?.schoolEmail && role.schoolEmailVerified,
        ),
        yearsFrom: role?.yearsFrom ?? null,
        subjects: role?.subjects ?? null,
      };
    }),
    results: results.map((u) => ({
      id: u.id,
      name: displayName(u, locale),
      roles: u.roles.map((r) => r.role),
    })),
  };
}

function userForm(userId: string) {
  const fd = new FormData();
  fd.set("userId", userId);
  return fd;
}

/** Make a member a current teacher (assignTeacherAction). */
export async function assignTeacher(user: CurrentUser, userId: string) {
  await teacherRegistrar(user);
  await assignTeacherAction(userForm(userId));
  return { ok: true as const };
}

/** Move a current teacher to former (unassignTeacherAction). */
export async function unassignTeacher(user: CurrentUser, userId: string) {
  await teacherRegistrar(user);
  await unassignTeacherAction(userForm(userId));
  return { ok: true as const };
}
