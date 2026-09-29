import { adminOnly } from "@/server/lib/mobile/admin";
import { loadAdminAudit } from "@/server/lib/mobile/admin/audit";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/** 監査ログ (?action=&target=&cursor=; contract: AdminAudit). Admins only. */
export const GET = mobileRoute(async ({ user, request, locale }) => {
  adminOnly(user);
  return loadAdminAudit(locale, query(request));
});
