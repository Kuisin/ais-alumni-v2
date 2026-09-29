import {
  adminDeleteEvent,
  adminEventDetail,
} from "@/server/lib/mobile/admin/events";
import { mobileRoute } from "@/server/lib/mobile/http";

/** One event in admin mode: details, approval, attendees, staff. */
export const GET = mobileRoute<{ id: string }>(async ({ params, locale }) =>
  adminEventDetail(params.id, locale),
);

/** Delete the event and its RSVPs (deleteEventAction). */
export const DELETE = mobileRoute<{ id: string }>(async ({ params }) =>
  adminDeleteEvent(params.id),
);
