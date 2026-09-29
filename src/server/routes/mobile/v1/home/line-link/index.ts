import { lineLinkStartUrl } from "@/server/lib/line-link";
import type { HomeLineLink } from "@/server/lib/mobile/contract/home";
import { ApiError, mobileRoute } from "@/server/lib/mobile/http";
import { ssoReady } from "@/server/lib/sso";

/**
 * A fresh URL that starts linking LINE to the member — the dashboard
 * banner's 「LINE を連携する」 (valid 10 minutes, so it's made on tap). The
 * app opens it in the browser, which isn't signed in, so the flow ends on
 * the website's standalone 「LINE を連携しました」 page.
 */
export const POST = mobileRoute(async ({ user, locale }) => {
  if (!ssoReady("line")) throw new ApiError(404, "line_unavailable");
  return {
    url: lineLinkStartUrl(user.id, "/app/dashboard", locale),
  } satisfies HomeLineLink;
});
