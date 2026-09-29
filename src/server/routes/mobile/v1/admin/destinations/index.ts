import { adminOnly } from "@/server/lib/mobile/admin";
import { loadAdminDestinations } from "@/server/lib/mobile/admin/destinations";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/** 進路 (?cohort=&f=1&hist=1&all=1; contract: AdminDestinations). Admins only. */
export const GET = mobileRoute(async ({ user, request, locale }) => {
  adminOnly(user);
  return loadAdminDestinations(locale, query(request));
});
