import { z } from "zod";
import { sendVerificationMessage } from "@/server/lib/mobile/admin-verification";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

// Length and emptiness are checked by sendVerificationMessage.
const Body = z.object({ body: z.string().max(4000) });

/**
 * 「やりとり」: a message to the applicant (or the parent managing the
 * child's account) without changing the status (contract:
 * VerificationActionResult). Committee admins only.
 */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) =>
    sendVerificationMessage(
      user,
      IdParam.parse(params.id),
      (await readJson(request, Body)).body,
    ),
);
