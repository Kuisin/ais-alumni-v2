import { ApiError, mobileRoute } from "@/server/lib/mobile/http";
import { sendTestPush } from "@/server/lib/mobile/notifications";
import { sessionFromRequest } from "@/server/lib/mobile/tokens";

/** A test notification to this device (Settings), in the member's language
 *  like every notification. */
export const POST = mobileRoute(async ({ request, user }) => {
  const s = await sessionFromRequest(request);
  if (!s) throw new ApiError(401, "unauthenticated");
  return sendTestPush(s, user.locale === "en" ? "en" : "ja");
}, "user");
