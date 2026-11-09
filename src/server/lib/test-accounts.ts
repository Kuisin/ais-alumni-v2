import type {
  TestAccount,
  TestAccountCreate,
  TestAccountType,
} from "@contract/admin-members";
import { Prisma } from "@/server/generated/prisma/client";
import {
  AccountState,
  Locale,
  RoleKey,
  VerificationStatus,
} from "@/server/generated/prisma/enums";
import { deleteUserAccount } from "@/server/lib/account";
import { audit } from "@/server/lib/audit";
import { normalizeEmail } from "@/server/lib/auth/otp";
import {
  elementaryEndFor,
  latestCohortNumber,
  suggestedStartYear,
} from "@/server/lib/cohorts";
import { ensureCohort } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { studentRoleFields, teacherFields } from "@/server/lib/member-status";
import { ApiError, notFound } from "@/server/lib/mobile/http";
import { nameColumns } from "@/server/lib/names";
import type { CurrentUser } from "@/server/lib/session";

/**
 * テストアカウント (管理モード, admins only): ACTIVE members made directly —
 * no application — so the committee can try the app as a parent, a current
 * student, a graduate, a current or a former teacher. They sign in with
 * the email code like anyone (Gmail plus-addresses work: name+parent@…).
 *
 * Hidden (User.isTest): left out of the directory and its count, member
 * searches and candidate lists (news audience members, family search,
 * vouchers, registered children), automatic group chats, statistics and
 * every bulk send (news, お知らせ, LINE announcements) — except for viewers
 * who are admins or test accounts themselves, so test accounts can find
 * each other to try follows, 1:1 talks and family links. The rules:
 * src/server/lib/test-hidden.ts.
 */

const TYPES: Record<
  TestAccountType,
  { role: RoleKey; teacher?: "CURRENT" | "FORMER" }
> = {
  PARENT: { role: RoleKey.CURRENT_PARENT },
  CURRENT_STUDENT: { role: RoleKey.CURRENT_STUDENT },
  GRADUATE: { role: RoleKey.FORMER_STUDENT },
  CURRENT_TEACHER: { role: RoleKey.TEACHER, teacher: "CURRENT" },
  FORMER_TEACHER: { role: RoleKey.TEACHER, teacher: "FORMER" },
};

/** The oldest class: graduated long ago. */
const GRADUATE_COHORT = 1;

/** "Test, Parent" → last "Test", first "Parent"; "Parent Test" likewise. */
function splitName(name: string): { last: string; first: string } {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.includes(",")) {
    const [last, ...rest] = n.split(",");
    return { last: last.trim(), first: rest.join(",").trim() || "Test" };
  }
  const parts = n.split(" ");
  if (parts.length === 1) return { last: parts[0], first: "Test" };
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" ") };
}

const dob = (y: number) => new Date(`${y}-06-01T00:00:00Z`);

export async function createTestAccount(
  admin: CurrentUser,
  input: TestAccountCreate,
  now: Date = new Date(),
): Promise<TestAccount> {
  const email = normalizeEmail(input.email);
  const taken = await db.user.findUnique({
    where: { primaryEmail: email },
    select: { id: true },
  });
  if (taken) throw new ApiError(409, "email_taken");
  const spec = TYPES[input.type];
  const { last, first } = splitName(input.name);
  const cols = nameColumns({
    lastNameRomaji: last,
    firstNameRomaji: first,
    middleNameRomaji: null,
    lastNameKanji: null,
    firstNameKanji: null,
  });
  const year = now.getUTCFullYear();

  const user = await db
    .$transaction(async (tx) => {
      let role: Prisma.UserRoleUncheckedCreateWithoutUserInput;
      let born: Date;
      if (input.type === "CURRENT_STUDENT" || input.type === "GRADUATE") {
        const number =
          input.type === "GRADUATE" ? GRADUATE_COHORT : latestCohortNumber(now);
        const end = elementaryEndFor(number);
        const cohortId = await ensureCohort(number, tx);
        const fields = studentRoleFields(
          end,
          suggestedStartYear(end),
          null,
          now,
        );
        role = { ...fields, cohortId };
        born = dob(end - 12);
      } else if (spec.teacher) {
        const f =
          spec.teacher === "CURRENT"
            ? teacherFields(year - 3, null, now)
            : teacherFields(2010, 2015, now);
        role = { role: RoleKey.TEACHER, ...f };
        born = dob(1980);
      } else {
        role = { role: RoleKey.CURRENT_PARENT };
        born = dob(1980);
      }
      const created = await tx.user.create({
        data: {
          ...cols,
          primaryEmail: email,
          emailVerifiedAt: now,
          state: AccountState.ACTIVE,
          locale: admin.locale === "en" ? Locale.en : Locale.ja,
          dateOfBirth: born,
          isTest: true,
          roles: { create: role },
        },
        select: { id: true, createdAt: true },
      });
      // As an approved member: an application on record, approved by the admin.
      await tx.verificationRequest.create({
        data: {
          userId: created.id,
          answers: { version: 2, testAccount: true, type: input.type },
          status: VerificationStatus.APPROVED,
          reviewerId: admin.id,
          reviewNote: "test account",
          decidedAt: now,
        },
      });
      return created;
    })
    .catch((e: unknown) => {
      // Taken meanwhile (primaryEmail is unique).
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        throw new ApiError(409, "email_taken");
      throw e;
    });

  await audit(
    admin.id,
    "user.test_account_created",
    { type: "User", id: user.id },
    { type: input.type, email },
  );
  return {
    id: user.id,
    name: displayName(cols),
    email,
    type: input.type,
    createdAt: user.createdAt.toISOString(),
  };
}

function typeOf(
  roles: { role: RoleKey; teacherStatus: string | null }[],
): TestAccountType | null {
  const r = roles[0];
  if (!r) return null;
  if (r.role === RoleKey.TEACHER)
    return r.teacherStatus === "FORMER" ? "FORMER_TEACHER" : "CURRENT_TEACHER";
  if (r.role === RoleKey.CURRENT_STUDENT) return "CURRENT_STUDENT";
  if (r.role === RoleKey.FORMER_STUDENT) return "GRADUATE";
  return "PARENT";
}

export async function listTestAccounts(): Promise<TestAccount[]> {
  const rows = await db.user.findMany({
    where: { isTest: true },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      nameRomaji: true,
      nameKanji: true,
      primaryEmail: true,
      createdAt: true,
      roles: { select: { role: true, teacherStatus: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: displayName(r),
    email: r.primaryEmail,
    type: typeOf(r.roles),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Delete a test account (account deletion, as the member's own). */
export async function deleteTestAccount(
  admin: CurrentUser,
  id: string,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id },
    select: { isTest: true, primaryEmail: true },
  });
  // Only test accounts: never a real member from here.
  if (!user?.isTest) throw notFound();
  const result = await deleteUserAccount(id);
  if (!result.ok)
    throw new ApiError(result.error === "not_found" ? 404 : 409, result.error);
  await audit(
    admin.id,
    "user.test_account_deleted",
    { type: "User", id },
    { email: user.primaryEmail },
  );
}
