import { adminEventCsv } from "@/server/lib/mobile/admin/events";
import { mobileRoute } from "@/server/lib/mobile/http";

/** Attendee list as a CSV file (the website's /api/admin/events/[id]/csv). */
export const GET = mobileRoute<{ id: string }>(async ({ user, params }) =>
  adminEventCsv(user, params.id),
);
