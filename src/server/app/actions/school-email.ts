// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { z } from "zod";
import { OtpPurpose, RoleKey } from "@/server/generated/prisma/enums";
import { issueOtp, normalizeEmail, verifyOtp } from "@/server/lib/auth/otp";
import { db } from "@/server/lib/db";
import { isCurrentTeacher } from "@/server/lib/school";
import { isSchoolEmail } from "@/server/lib/school-email";
import { schoolEmailTaken } from "@/server/lib/school-email-db";
import { actionActive, type CurrentUser } from "@/server/lib/session";

/**
 * 設定 → 学校のメールアドレス（業務用）: approved teachers add or change
 * their @aisnagoya.net address, confirmed with a code, on their TEACHER
 * role. It is never used for sign-in or notifications.
 */

/** As the website's src/app/actions/verify.ts. */
export type SchoolEmailResult = {
  ok: boolean;
  error?:
    | "forbidden"
    | "invalidEmail"
    | "wrongDomain"
    | "taken"
    | "rateLimited"
    | "sendFailed"
    | "invalid"
    | "expired"
    | "tooManyAttempts";
};

async function teacher(): Promise<CurrentUser | null> {
  const user = await actionActive().catch(() => null);
  return user?.roles.some((r) => r.role === RoleKey.TEACHER) ? user : null;
}

const emailSchema = z.email().max(254);

export async function sendMySchoolEmailCodeAction(
  email: string,
): Promise<SchoolEmailResult> {
  const user = await teacher();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = emailSchema.safeParse(
    typeof email === "string" ? email.trim() : "",
  );
  if (!parsed.success) return { ok: false, error: "invalidEmail" };
  if (!isSchoolEmail(parsed.data)) return { ok: false, error: "wrongDomain" };
  if (await schoolEmailTaken(parsed.data, user.id))
    return { ok: false, error: "taken" };
  const res = await issueOtp({
    email: parsed.data,
    purpose: OtpPurpose.SCHOOL_EMAIL,
    locale: user.locale,
    userId: user.id,
  });
  if (res.ok) return { ok: true };
  return {
    ok: false,
    error: res.error === "send_failed" ? "sendFailed" : "rateLimited",
  };
}

/** Confirm the code; the address is then saved as verified. */
export async function verifyMySchoolEmailCodeAction(
  email: string,
  code: string,
): Promise<SchoolEmailResult> {
  const user = await teacher();
  if (!user) return { ok: false, error: "forbidden" };
  const e = emailSchema.safeParse(
    typeof email === "string" ? email.trim() : "",
  );
  const c = z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .safeParse(code);
  if (!e.success) return { ok: false, error: "invalidEmail" };
  if (!isSchoolEmail(e.data)) return { ok: false, error: "wrongDomain" };
  if (!c.success) return { ok: false, error: "invalid" };
  if (await schoolEmailTaken(e.data, user.id))
    return { ok: false, error: "taken" };
  const res = await verifyOtp({
    email: e.data,
    purpose: OtpPurpose.SCHOOL_EMAIL,
    code: c.data,
    userId: user.id,
  });
  if (!res.ok)
    return {
      ok: false,
      error: res.error === "too_many_attempts" ? "tooManyAttempts" : res.error,
    };
  try {
    await db.userRole.updateMany({
      where: { userId: user.id, role: RoleKey.TEACHER },
      data: { schoolEmail: normalizeEmail(e.data), schoolEmailVerified: true },
    });
  } catch {
    // Unique: claimed by someone else in the meantime.
    return { ok: false, error: "taken" };
  }
  refresh();
  return { ok: true };
}

/** Remove the school address (former teachers only: current ones need it). */
export async function removeMySchoolEmailAction(): Promise<void> {
  const user = await teacher();
  if (!user) return;
  const role = user.roles.find((r) => r.role === RoleKey.TEACHER);
  if (role && isCurrentTeacher(role.yearsTo)) return;
  await db.userRole.updateMany({
    where: { userId: user.id, role: RoleKey.TEACHER },
    data: { schoolEmail: null, schoolEmailVerified: false },
  });
  refresh();
}
