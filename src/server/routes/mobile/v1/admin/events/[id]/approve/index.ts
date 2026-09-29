import { adminApproveEvent } from "@/server/lib/mobile/admin/events";
import { mobileRoute } from "@/server/lib/mobile/http";

/** Approve a 同窓会委員's event (approveEventAction). */
export const POST = mobileRoute<{ id: string }>(async ({ params }) =>
  adminApproveEvent(params.id),
);
