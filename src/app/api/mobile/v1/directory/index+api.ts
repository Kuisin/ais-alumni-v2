import { mobileRoute, query } from "@/server/lib/mobile/http";
import { directoryPage } from "@/server/lib/mobile/people";

/**
 * 会員名簿, one page (contract: DirectoryPage). The website's parameters:
 * ?q=&role=&from=&to=&division=&stage=&cohort=&cursor= — parsed by the
 * same parseDirectoryFilters (invalid values are ignored).
 */
export const GET = mobileRoute(({ request, user, locale }) =>
  directoryPage(user, query(request), locale),
);
