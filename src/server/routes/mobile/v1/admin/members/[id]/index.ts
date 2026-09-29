import { adminOnly } from "@/server/lib/mobile/admin";
import { adminMemberDetail } from "@/server/lib/mobile/admin-members";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** One member, everything the admin page shows (AdminMemberDetail). */
export const GET = mobileRoute<{ id: string }>(({ user, params, locale }) => {
  adminOnly(user);
  return adminMemberDetail(user, IdParam.parse(params.id), locale);
});
