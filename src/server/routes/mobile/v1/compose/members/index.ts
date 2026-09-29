import { searchAudienceMembersAction } from "@/server/app/actions/admin-content";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/** Members to add individually, by name (authors except 学年代表). */
export const GET = mobileRoute(async ({ request }) => ({
  members: await searchAudienceMembersAction(query(request).q ?? ""),
}));
