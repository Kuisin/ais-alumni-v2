import { AccountState, OtpPurpose } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { normalizeEmail, OTP_MAX_ATTEMPTS, verifyOtp } from "./otp";

/**
 * Email sign-in (§4.1): check the 6-digit code and return the member,
 * creating the account on first sign-in. Shared by the Auth.js email-otp
 * provider (src/auth.ts) and the native app (api/mobile/v1/auth/email).
 */
export async function userForSignInCode(params: {
  email: string;
  code: string;
  locale?: "ja" | "en";
}): Promise<{ id: string; primaryEmail: string | null } | null> {
  const email = normalizeEmail(params.email);
  const result = await verifyOtp({
    email,
    purpose: OtpPurpose.SIGN_IN,
    code: params.code,
  });
  if (!result.ok) return null;
  const existing = await db.user.findUnique({
    where: { primaryEmail: email },
    select: { id: true, primaryEmail: true },
  });
  if (existing) return existing;
  return db.user.create({
    data: {
      primaryEmail: email,
      emailVerifiedAt: new Date(),
      state: AccountState.EMAIL_VERIFIED,
      locale: params.locale ?? "ja",
    },
    select: { id: true, primaryEmail: true },
  });
}

export type SignInCodeProblem = "invalid" | "expired" | "too_many_attempts";

/**
 * Explain why a sign-in code was rejected without consuming anything: looks
 * at the newest outstanding code for the address (read-only).
 */
export async function diagnoseSignInCode(
  email: string,
): Promise<SignInCodeProblem> {
  const row = await db.otpCode.findFirst({
    where: {
      email: normalizeEmail(email),
      purpose: OtpPurpose.SIGN_IN,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { expiresAt: true, attempts: true },
  });
  if (!row) return "invalid";
  if (row.expiresAt < new Date()) return "expired";
  if (row.attempts >= OTP_MAX_ATTEMPTS) return "too_many_attempts";
  return "invalid";
}
