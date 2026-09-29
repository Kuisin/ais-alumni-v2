import { familySearch, SearchQuery } from "@/server/lib/mobile/family";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/**
 * ?direction=child|parent&q=… — members I could claim as my child / parent
 * (contract: FamilySearch).
 */
export const GET = mobileRoute(({ request, user, locale }) => {
  const { direction, q } = SearchQuery.parse(query(request));
  return familySearch(user, direction, q, locale);
});
