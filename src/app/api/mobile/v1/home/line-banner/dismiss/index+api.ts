import { dismissLineBannerAction } from "@/server/components/line/actions";
import { mobileRoute } from "@/server/lib/mobile/http";

/** The LINE banner's 「今はしない」: hidden for 30 days (the website's action). */
export const POST = mobileRoute(async () => {
  await dismissLineBannerAction();
  return { ok: true as const };
});
