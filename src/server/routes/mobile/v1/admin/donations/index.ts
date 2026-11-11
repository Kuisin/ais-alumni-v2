import { loadAdminDonations } from "@/server/lib/donations-history";
import { adminOnly } from "@/server/lib/mobile/admin";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/** 寄付 (?cursor=; contract: AdminDonations). Admins only. */
export const GET = mobileRoute(async ({ user, request }) => {
  adminOnly(user);
  return loadAdminDonations(query(request).cursor || undefined);
});
