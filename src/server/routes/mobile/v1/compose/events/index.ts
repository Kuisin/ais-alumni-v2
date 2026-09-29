import { saveEventAction } from "@/server/app/actions/admin-content";
import { readForm, savedResponse } from "@/server/lib/mobile/compose";
import { mobileRoute } from "@/server/lib/mobile/http";

/** Create (no id) or edit an event, as POST /compose/news. */
export const POST = mobileRoute(async ({ request }) =>
  savedResponse(await saveEventAction({}, await readForm(request))),
);
