import { adminOnly } from "@/server/lib/mobile/admin";
import { richMenuPreview } from "@/server/lib/mobile/admin/line";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/**
 * The rich menu image (PNG; ?locale=ja|en&chats=1&news=1). The website
 * serves it to anyone at /api/line/richmenu/<locale>; here it is for the
 * admin page only.
 */
export const GET = mobileRoute(async ({ user, request }) => {
  adminOnly(user);
  return richMenuPreview(query(request));
});
