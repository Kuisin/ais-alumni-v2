import { answerRsvp, RsvpBody } from "@/server/lib/mobile/events";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

/** Answer or change the member's RSVP: { answer, guests } → the event. */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, params, user, locale }) =>
    answerRsvp(user, locale, params.id, await readJson(request, RsvpBody)),
);
