import { adminOnly } from "@/server/lib/mobile/admin";
import { loadAdminChat } from "@/server/lib/mobile/admin/inbox";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/**
 * Chat moderation: 1:1 talk rules and reports (?tab=open|closed;
 * contract: AdminChat). Admins only.
 */
export const GET = mobileRoute(async ({ user, request, locale }) => {
  adminOnly(user);
  return loadAdminChat(locale, query(request).tab);
});
