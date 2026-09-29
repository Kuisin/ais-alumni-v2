import { z } from "zod";
import { toggleReactionAction } from "@/server/app/actions/news-hub";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { hubResponse } from "@/server/lib/mobile/news";

const Body = z.object({ emoji: z.string().min(1).max(16) });

/** Toggle the member's reaction (one of the website's REACTIONS). */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) => {
  const { emoji } = await readJson(request, Body);
  return hubResponse(await toggleReactionAction(params.id, emoji));
});
