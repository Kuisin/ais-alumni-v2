import { adminOnly } from "@/server/lib/mobile/admin";
import { loadAdminSupport } from "@/server/lib/mobile/admin/inbox";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/** お問い合わせ inbox (?tab=open|closed; contract: AdminSupport). Admins only. */
export const GET = mobileRoute(async ({ user, request, locale }) => {
  adminOnly(user);
  return loadAdminSupport(locale, query(request).tab);
});
