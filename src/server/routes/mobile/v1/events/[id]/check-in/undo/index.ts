import { z } from "zod";
import { undoCheckInAction } from "@/server/app/actions/check-in";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({ userId: z.string().max(64) });

/** Undo a mistaken check-in (staff). */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) => {
  const { userId } = await readJson(request, Body);
  return undoCheckInAction(params.id, userId);
});
