import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  APPLICANT_STATES,
  confirmSchoolEmailCode,
  inState,
} from "@/server/lib/mobile/onboarding";

const Body = z.object({ email: z.string().max(300), code: z.string().max(20) });

/** Teachers: confirm the code; submitting the application records it. */
export const POST = mobileRoute(async ({ request }) => {
  const user = await inState(...APPLICANT_STATES);
  const { email, code } = await readJson(request, Body);
  await confirmSchoolEmailCode(user, email, code);
  return { ok: true as const };
}, "user");
