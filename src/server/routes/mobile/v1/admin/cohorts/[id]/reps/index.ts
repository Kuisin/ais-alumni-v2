import { z } from "zod";
import { setCohortRepAction } from "@/server/app/actions/admin-positions";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({ userId: IdParam, on: z.boolean() });

/**
 * Make a member the 学年's 学年代表, or remove them → AdminFormResult
 * (key in "adminMembers.positions").
 */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) => {
  const { userId, on } = await readJson(request, Body);
  return setCohortRepAction(IdParam.parse(params.id), userId, on);
});
