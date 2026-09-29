import { z } from "zod";
import { addCommentAction } from "@/server/app/actions/news-hub";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { hubResponse } from "@/server/lib/mobile/news";

// Length and flood limits are the action's (MAX_COMMENT_LENGTH → invalid).
const Body = z.object({ body: z.string().max(10_000) });

/** Add a comment. */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) => {
  const { body } = await readJson(request, Body);
  return hubResponse(await addCommentAction(params.id, body));
});
