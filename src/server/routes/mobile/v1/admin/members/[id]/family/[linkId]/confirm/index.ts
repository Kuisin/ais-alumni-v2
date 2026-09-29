import { confirmFamilyLinkAdminAction } from "@/server/app/actions/admin-family";
import { adminOnly } from "@/server/lib/mobile/admin";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** 家族: confirm a pending link (both people have accounts). */
export const POST = mobileRoute<{ id: string; linkId: string }>(
  async ({ user, params }) => {
    adminOnly(user);
    return confirmFamilyLinkAdminAction(IdParam.parse(params.linkId));
  },
);
