import { mobileRoute } from "@/server/lib/mobile/http";
import { newsDetail } from "@/server/lib/mobile/news";

/**
 * One ニュース post with its hub (contract: NewsDetail). Like opening the
 * website's page, this records the read (not for an admin-only view).
 */
export const GET = mobileRoute<{ id: string }>(({ user, params, locale }) =>
  newsDetail(user, params.id, locale),
);
