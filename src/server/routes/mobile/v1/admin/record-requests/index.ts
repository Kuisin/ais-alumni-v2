import {
  adminRecordRequests,
  parseTab,
} from "@/server/lib/mobile/admin-requests";
import { mobileRoute } from "@/server/lib/mobile/http";

/** 在籍情報の修正 requests (contract: AdminRecordRequests). Admins. */
export const GET = mobileRoute(({ user, request, locale }) =>
  adminRecordRequests(user, parseTab(request.url), locale),
);
