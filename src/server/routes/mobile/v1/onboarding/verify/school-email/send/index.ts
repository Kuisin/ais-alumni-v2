import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  APPLICANT_STATES,
  inState,
  sendSchoolEmailCode,
} from "@/server/lib/mobile/onboarding";

const Body = z.object({ email: z.string().max(300) });

/** Teachers: send a code to an @aisnagoya.net address (verify.schoolEmail.errors.<code>). */
export const POST = mobileRoute(async ({ request }) => {
  const user = await inState(...APPLICANT_STATES);
  const { email } = await readJson(request, Body);
  await sendSchoolEmailCode(user, email);
  return { ok: true as const };
}, "user");
