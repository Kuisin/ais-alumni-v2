import { mobileRoute, query } from "@/server/lib/mobile/http";
import { inboxPage } from "@/server/lib/mobile/notifications";

/** The notification list (お知らせ), newest first; ?cursor= for more. */
export const GET = mobileRoute(async ({ request, user, locale }) =>
  inboxPage(user, query(request).cursor, locale),
);
