import { adminOnly } from "@/server/lib/mobile/admin";
import { loadAdminOrgs } from "@/server/lib/mobile/admin/organizations";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/** Schools / companies (?kind=school|company&sort=name|count&q=). Admins only. */
export const GET = mobileRoute(async ({ user, request }) => {
  adminOnly(user);
  return loadAdminOrgs(query(request));
});
