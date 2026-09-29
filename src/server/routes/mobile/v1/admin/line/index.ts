import { adminOnly } from "@/server/lib/mobile/admin";
import { loadAdminLine } from "@/server/lib/mobile/admin/line";
import { mobileRoute } from "@/server/lib/mobile/http";

/** LINE: usage and the rich menu (contract: AdminLine). Admins only. */
export const GET = mobileRoute(async ({ user }) => {
  adminOnly(user);
  return loadAdminLine();
});
