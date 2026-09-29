import { z } from "zod";
import {
  isRedirect,
  setMemberAdminAction,
} from "@/server/app/actions/admin-members";
import { adminOnly } from "@/server/lib/mobile/admin";
import { formData, result } from "@/server/lib/mobile/admin-members";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({ grant: z.boolean() });

/**
 * 管理者権限: setMemberAdminAction (AdminResult). Revoking one's own rights
 * redirects out of admin mode on the website; here the answer is
 * `{ ok: true }` and the app leaves admin mode when /me no longer allows it.
 */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    adminOnly(user);
    const { grant } = await readJson(request, Body);
    try {
      return result(
        await setMemberAdminAction(
          {},
          formData({
            userId: IdParam.parse(params.id),
            grant: grant ? "yes" : "no",
          }),
        ),
      );
    } catch (e) {
      if (isRedirect(e)) return { ok: true };
      throw e;
    }
  },
);
