import { eventDetail } from "@/server/lib/mobile/events";
import { mobileRoute } from "@/server/lib/mobile/http";

/** One event with the member's RSVP and ticket (the website's /app/events/[id]). */
export const GET = mobileRoute<{ id: string }>(({ params, user, locale }) =>
  eventDetail(user, locale, params.id),
);
