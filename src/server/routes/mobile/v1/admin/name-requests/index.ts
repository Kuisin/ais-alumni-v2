import {
  adminNameRequests,
  parseTab,
} from "@/server/lib/mobile/admin-requests";
import { mobileRoute } from "@/server/lib/mobile/http";

/** 氏名・生年月日・性別 requests (contract: AdminNameRequests). Admins. */
export const GET = mobileRoute(({ user, request, locale }) =>
  adminNameRequests(user, parseTab(request.url), locale),
);
