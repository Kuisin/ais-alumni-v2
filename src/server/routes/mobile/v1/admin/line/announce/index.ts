import { adminOnly } from "@/server/lib/mobile/admin";
import {
  AnnounceSchema,
  previewLineAnnouncement,
  sendLineAnnouncement,
} from "@/server/lib/mobile/admin/line";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

/**
 * 「LINE でお知らせ」: one text to every member on LINE (an English one to
 * members using English, when given). `preview` counts
 * (contract: LineAnnouncePreview), `send` sends (LineAnnounceSent). Admins only.
 */
export const POST = mobileRoute(async ({ user, request }) => {
  adminOnly(user);
  const { intent, text, textEn } = await readJson(request, AnnounceSchema);
  return intent === "send"
    ? sendLineAnnouncement(user.id, text, textEn || undefined)
    : previewLineAnnouncement();
});
