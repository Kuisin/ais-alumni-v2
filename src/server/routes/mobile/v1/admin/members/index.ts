import { adminOnly } from "@/server/lib/mobile/admin";
import { adminMemberList } from "@/server/lib/mobile/admin-members";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/**
 * 会員 (admin): search and filters as the website's list, 25 at a time
 * (contract: AdminMemberList). Committee admins only.
 */
export const GET = mobileRoute(({ request, user, locale }) => {
  adminOnly(user);
  return adminMemberList(query(request), locale);
});
