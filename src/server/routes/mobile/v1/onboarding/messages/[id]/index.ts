import { z } from "zod";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  applicationThread,
  replyToThread,
} from "@/server/lib/mobile/verification-messages";
import { AttachmentRefs } from "@/server/lib/verification/attachments";

/** One application's 「やりとり」 (contract: ApplicationThread). */
export const GET = mobileRoute<{ id: string }>(
  ({ user, params, locale }) =>
    applicationThread(user, IdParam.parse(params.id), locale),
  "user",
);

// Length and emptiness are checked by replyToThread.
const Body = z.object({
  body: z.string().max(4000),
  attachments: AttachmentRefs,
});

/**
 * {body, attachments?}: reply (contract: ApplicationReplySent; errors 400
 * invalid / attachments, 409 closed). Attachments are uploads of mine
 * (…/attachments). A NEEDS_INFO application goes back to review.
 */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params, locale }) => {
    const { body, attachments } = await readJson(request, Body);
    return replyToThread(
      user,
      IdParam.parse(params.id),
      body,
      locale,
      attachments,
    );
  },
  "user",
);
