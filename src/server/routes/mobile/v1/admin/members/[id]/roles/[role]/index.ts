import { removeMemberRoleAction } from "@/server/app/actions/admin-members";
import { adminOnly } from "@/server/lib/mobile/admin";
import { formData, result } from "@/server/lib/mobile/admin-members";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** Remove a role: removeMemberRoleAction (AdminResult). */
export const DELETE = mobileRoute<{ id: string; role: string }>(
  async ({ user, params }) => {
    adminOnly(user);
    return result(
      await removeMemberRoleAction(
        {},
        formData({
          userId: IdParam.parse(params.id),
          role: IdParam.parse(params.role),
        }),
      ),
    );
  },
);
