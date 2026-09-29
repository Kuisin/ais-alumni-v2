import { z } from "zod";
import { setMemberStateAction } from "@/server/app/actions/admin-members";
import { adminOnly } from "@/server/lib/mobile/admin";
import { formData, result } from "@/server/lib/mobile/admin-members";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({ state: z.enum(["ACTIVE", "DEACTIVATED"]) });

/** Deactivate / reactivate: setMemberStateAction (AdminResult). */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    adminOnly(user);
    const { state } = await readJson(request, Body);
    return result(
      await setMemberStateAction(
        {},
        formData({ userId: IdParam.parse(params.id), state }),
      ),
    );
  },
);
