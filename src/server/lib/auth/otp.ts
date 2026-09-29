import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Locale, OtpPurpose } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { db } from "@/server/lib/db";
import { sendEmail } from "@/server/lib/email";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes (§4.1)
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashCode(id: string, code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`${id}:${code}`).digest("hex");
}

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export type IssueResult =
  | { ok: true }
  | { ok: false; error: "rate_limited" | "send_failed" };

/** Create and email a 6-digit code. Rate-limited per email + purpose. */
export async function issueOtp(params: {
  email: string;
  purpose: OtpPurpose;
  locale: Locale;
  userId?: string;
}): Promise<IssueResult> {
  const email = normalizeEmail(params.email);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.otpCode.findMany({
    where: { email, purpose: params.purpose, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (
    recent.length >= OTP_MAX_PER_HOUR ||
    (recent[0] &&
      Date.now() - recent[0].createdAt.getTime() < OTP_RESEND_COOLDOWN_MS)
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const code = generateCode();
  const row = await db.otpCode.create({
    data: {
      email,
      purpose: params.purpose,
      userId: params.userId,
      codeHash: "pending",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  await db.otpCode.update({
    where: { id: row.id },
    data: { codeHash: hashCode(row.id, code) },
  });

  const t = await getTranslatorFor(params.locale, "email");
  try {
    await sendEmail({
      to: email,
      subject: t("otp.subject", { code }),
      text: t("otp.body", { code, minutes: OTP_TTL_MS / 60000 }),
    });
  } catch (e) {
    // Email provider down or misconfigured: drop the unsent code so it
    // doesn't count toward the rate limit, and let the form say so.
    console.error("[otp] failed to send code", e);
    await db.otpCode.delete({ where: { id: row.id } });
    return { ok: false, error: "send_failed" };
  }
  return { ok: true };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "expired" | "too_many_attempts" };

/**
 * Check a code against the newest outstanding code for (email, purpose[, userId]).
 * Consumes the code on success.
 */
export async function verifyOtp(params: {
  email: string;
  purpose: OtpPurpose;
  code: string;
  userId?: string;
}): Promise<VerifyResult> {
  const email = normalizeEmail(params.email);
  const row = await db.otpCode.findFirst({
    where: {
      email,
      purpose: params.purpose,
      consumedAt: null,
      ...(params.userId ? { userId: params.userId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, error: "invalid" };
  if (row.expiresAt < new Date()) return { ok: false, error: "expired" };
  if (row.attempts >= OTP_MAX_ATTEMPTS)
    return { ok: false, error: "too_many_attempts" };

  const code = params.code.replace(/\s/g, "");
  const expected = Buffer.from(row.codeHash, "hex");
  const given = Buffer.from(hashCode(row.id, code), "hex");
  const match =
    /^\d{6}$/.test(code) &&
    expected.length === given.length &&
    timingSafeEqual(expected, given);

  if (!match) {
    await db.otpCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return {
      ok: false,
      error:
        row.attempts + 1 >= OTP_MAX_ATTEMPTS ? "too_many_attempts" : "invalid",
    };
  }
  // Conditional update guards against the same code being used twice concurrently.
  const consumed = await db.otpCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return consumed.count === 1 ? { ok: true } : { ok: false, error: "invalid" };
}
