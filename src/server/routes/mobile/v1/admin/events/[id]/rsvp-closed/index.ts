import {
  adminSetRsvpClosed,
  RsvpClosedBody,
} from "@/server/lib/mobile/admin/events";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

/** Close RSVPs early, or reopen them: { close } (setEventRsvpClosedAction). */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) =>
  adminSetRsvpClosed(params.id, await readJson(request, RsvpClosedBody)),
);
