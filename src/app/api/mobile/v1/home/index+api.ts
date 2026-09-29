import { homeFor } from "@/server/lib/mobile/home";
import { mobileRoute } from "@/server/lib/mobile/http";

/** ホーム: the website's dashboard (contract: Home). */
export const GET = mobileRoute(({ user, locale }) => homeFor(user, locale));
