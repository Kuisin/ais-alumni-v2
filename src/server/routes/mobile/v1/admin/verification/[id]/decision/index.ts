import { z } from "zod";
import { decideVerification } from "@/server/lib/mobile/admin-verification";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

// Checked in full by the website's action (decideVerificationAction).
const Body = z.object({
  decision: z.string().max(20),
  note: z.string().max(4000).optional(),
});

/**
 * Approve / reject / ask for more information
 * (contract: VerificationActionResult). Committee admins only.
 */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) =>
    decideVerification(
      user,
      IdParam.parse(params.id),
      await readJson(request, Body),
    ),
);
