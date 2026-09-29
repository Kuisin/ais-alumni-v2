import { adminEventXlsx } from "@/server/lib/mobile/admin/events";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/** Event and attendees as an Excel workbook (?lang=ja|en), as the website's. */
export const GET = mobileRoute<{ id: string }>(
  async ({ request, user, params }) =>
    adminEventXlsx(user, params.id, query(request).lang ?? null),
);
