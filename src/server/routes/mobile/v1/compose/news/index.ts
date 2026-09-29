import { saveNewsAction } from "@/server/app/actions/admin-content";
import { readForm, savedResponse } from "@/server/lib/mobile/compose";
import { mobileRoute } from "@/server/lib/mobile/http";

/**
 * Create (no id) or edit a ニュース post: the website form's fields as
 * multipart/form-data, checked and saved by the website's action (authors
 * only; others edit only their own posts, admins any).
 */
export const POST = mobileRoute(async ({ request }) =>
  savedResponse(await saveNewsAction({}, await readForm(request))),
);
