import { adminOnly } from "@/server/lib/mobile/admin";
import { loadAdminStats } from "@/server/lib/mobile/admin/stats";
import { mobileRoute } from "@/server/lib/mobile/http";

/** 統計 (contract: AdminStats). Admins only. */
export const GET = mobileRoute(async ({ user }) => {
  adminOnly(user);
  return loadAdminStats();
});
