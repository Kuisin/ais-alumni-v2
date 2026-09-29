import { z } from "zod";
import { OtpPurpose } from "@/server/generated/prisma/enums";
import { issueOtp, normalizeEmail } from "@/server/lib/auth/otp";
import type { EmailCodeResult } from "@/server/lib/mobile/contract/core";
import { ApiError, publicRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({
  email: z.string(),
  locale: z.enum(["ja", "en"]).catch("ja"),
});

/**
 * Email sign-in, step 1 (§4.1): send a 6-digit code. Same rate limits as
 * the website's form (issueOtp); a recent code counts as sent.
 */
export const POST = publicRoute(async (request): Promise<EmailCodeResult> => {
  const body = await readJson(request, Body);
  const email = z.email().max(254).safeParse(body.email.trim());
  if (!email.success) throw new ApiError(400, "invalid_email");
  const result = await issueOtp({
    email: normalizeEmail(email.data),
    purpose: OtpPurpose.SIGN_IN,
    locale: body.locale,
  });
  if (result.ok) return { ok: true, notice: "sent" };
  if (result.error === "send_failed") throw new ApiError(502, "send_failed");
  return { ok: true, notice: "rate_limited" };
});
