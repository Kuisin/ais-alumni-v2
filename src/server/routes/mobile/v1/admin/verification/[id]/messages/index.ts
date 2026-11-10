import { z } from "zod";
import { sendVerificationMessage } from "@/server/lib/mobile/admin-verification";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";
import { AttachmentRefs } from "@/server/lib/verification/attachments";

// Length and emptiness are checked by sendVerificationMessage.
const Body = z.object({
  body: z.string().max(4000),
  attachments: AttachmentRefs,
});

/**
 * 「やりとり」: a message to the applicant (or the parent managing the
 * child's account) without changing the status (contract:
 * VerificationActionResult). Committee admins only. attachments: uploads
 * of mine (…/messages/attachments), up to 3.
 */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    const { body, attachments } = await readJson(request, Body);
    return sendVerificationMessage(
      user,
      IdParam.parse(params.id),
      body,
      attachments,
    );
  },
);
