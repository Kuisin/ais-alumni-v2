import { EventListQuery, listEvents } from "@/server/lib/mobile/events";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/** イベント list: ?tab=upcoming|past&page=N (the website's /app/events). */
export const GET = mobileRoute(({ request, user, locale }) => {
  const { tab, page } = EventListQuery.parse(query(request));
  return listEvents(user, locale, tab, page);
});
