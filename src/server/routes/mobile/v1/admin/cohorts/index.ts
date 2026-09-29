import { adminOnly } from "@/server/lib/mobile/admin";
import { loadAdminCohorts } from "@/server/lib/mobile/admin/cohorts";
import { mobileRoute } from "@/server/lib/mobile/http";

/** 学年 list (contract: AdminCohorts). Admins only. */
export const GET = mobileRoute(async ({ user, locale }) => {
  adminOnly(user);
  return loadAdminCohorts(locale);
});
