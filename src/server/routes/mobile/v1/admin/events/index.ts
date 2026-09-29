import { adminEventList } from "@/server/lib/mobile/admin/events";
import { mobileRoute } from "@/server/lib/mobile/http";

/** イベント管理: upcoming and recent past events the member manages. */
export const GET = mobileRoute(async ({ locale }) => adminEventList(locale));
