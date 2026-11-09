import { z } from "zod";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  applicationThread,
  replyToThread,
} from "@/server/lib/mobile/verification-messages";

/** One application's 「やりとり」 (contract: ApplicationThread). */
export const GET = mobileRoute<{ id: string }>(
  ({ user, params, locale }) =>
    applicationThread(user, IdParam.parse(params.id), locale),
  "user",
);

// Length and emptiness are checked by replyToThread.
const Body = z.object({ body: z.string().max(4000) });

/**
 * {body}: reply (contract: ApplicationReplySent; errors 400 invalid,
 * 409 closed). A NEEDS_INFO application goes back to review.
 */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params, locale }) =>
    replyToThread(
      user,
      IdParam.parse(params.id),
      (await readJson(request, Body)).body,
      locale,
    ),
  "user",
);
