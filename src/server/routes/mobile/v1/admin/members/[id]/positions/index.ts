import { z } from "zod";
import { setMemberPositionAction } from "@/server/app/actions/admin-positions";
import { adminOnly } from "@/server/lib/mobile/admin";
import { formData } from "@/server/lib/mobile/admin-members";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({
  position: z.string().max(40),
  grant: z.boolean(),
  cohortNumber: z.string().max(10).default(""),
});

/**
 * 役職: setMemberPositionAction. Answer `{ ok, message }`, message = key in
 * adminMembers.positions.
 */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    adminOnly(user);
    const b = await readJson(request, Body);
    const state = await setMemberPositionAction(
      null,
      formData({
        userId: IdParam.parse(params.id),
        position: b.position,
        grant: b.grant ? "yes" : "no",
        cohortNumber: b.cohortNumber,
      }),
    );
    return { ok: Boolean(state?.ok), message: state?.message };
  },
);
