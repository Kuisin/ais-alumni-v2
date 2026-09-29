import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { markInboxSeen, ReadBody } from "@/server/lib/mobile/notifications";

/** Mark notifications as seen ({ ids } or all). */
export const POST = mobileRoute(async ({ request, user }) =>
  markInboxSeen(user, await readJson(request, ReadBody)),
);
