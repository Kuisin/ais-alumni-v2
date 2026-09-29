import type { VerifyForm } from "@contract/onboarding";
import { z } from "zod";
import { mobileRoute, query, readJson } from "@/server/lib/mobile/http";
import {
  APPLICANT_STATES,
  inState,
  submitVerification,
  verifyFormFor,
} from "@/server/lib/mobile/onboarding";

const Invite = z.string().min(1).max(100).nullable().catch(null);

/**
 * The application form (/app/onboarding/verify): first submission, or a
 * resubmission after NEEDS_INFO. `?invite=` (the invitation the app kept)
 * prefills the type and 学年 as the website's invite cookie does.
 */
export const GET = mobileRoute(async ({ request }) => {
  const user = await inState(...APPLICANT_STATES);
  const q = query(request);
  const uiLocale = q.locale === "en" ? "en" : q.locale === "ja" ? "ja" : null;
  return (await verifyFormFor(
    user,
    uiLocale ?? (user.locale === "en" ? "en" : "ja"),
    Invite.parse(q.invite ?? null),
  )) satisfies VerifyForm;
}, "user");

const Body = z.object({
  payload: z.unknown(),
  uiLocale: z.enum(["ja", "en"]).nullable().catch(null),
  invite: Invite.optional(),
});

/**
 * Send the application: 400 `{ error: "validation" | "evidence" |
 * "generic", errors? }` (errors: form path → verify.errors.<code>).
 */
export const POST = mobileRoute(async ({ request }) => {
  const user = await inState(...APPLICANT_STATES);
  const body = await readJson(request, Body);
  await submitVerification(
    user,
    body.payload,
    body.uiLocale,
    body.invite ?? null,
  );
  return { ok: true as const };
}, "user");
