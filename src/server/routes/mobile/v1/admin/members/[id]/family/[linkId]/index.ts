import { removeFamilyLinkAdminAction } from "@/server/app/actions/admin-family";
import { adminOnly } from "@/server/lib/mobile/admin";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** 家族: remove a link; a confirmed one may split the family. */
export const DELETE = mobileRoute<{ id: string; linkId: string }>(
  async ({ user, params }) => {
    adminOnly(user);
    return removeFamilyLinkAdminAction(IdParam.parse(params.linkId));
  },
);
