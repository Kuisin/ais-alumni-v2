import { searchCheckInAction } from "@/server/app/actions/check-in";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/** Walk-ins by name: ACTIVE members in the event's audience (staff). */
export const GET = mobileRoute<{ id: string }>(async ({ request, params }) => ({
  candidates: await searchCheckInAction(params.id, query(request).q ?? ""),
}));
