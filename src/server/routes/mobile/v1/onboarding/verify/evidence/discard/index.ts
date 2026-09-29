import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  APPLICANT_STATES,
  discardEvidence,
  inState,
} from "@/server/lib/mobile/onboarding";

const Body = z.object({ key: z.string().min(1).max(500) });

/** Remove a file uploaded but not sent yet (sent ones go on resubmission). */
export const POST = mobileRoute(async ({ request }) => {
  const user = await inState(...APPLICANT_STATES);
  const { key } = await readJson(request, Body);
  await discardEvidence(user, key);
  return { ok: true as const };
}, "user");
