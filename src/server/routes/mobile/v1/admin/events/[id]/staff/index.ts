import {
  adminSetStaff,
  adminStaffSearch,
  StaffBody,
} from "@/server/lib/mobile/admin/events";
import { mobileRoute, query, readJson } from "@/server/lib/mobile/http";

/** Members to add as 受付スタッフ, by name (?q=). */
export const GET = mobileRoute<{ id: string }>(async ({ request }) =>
  adminStaffSearch(query(request).q ?? ""),
);

/** Add or remove a 受付スタッフ: { userId, on } (setEventStaffAction). */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) =>
  adminSetStaff(params.id, await readJson(request, StaffBody)),
);
