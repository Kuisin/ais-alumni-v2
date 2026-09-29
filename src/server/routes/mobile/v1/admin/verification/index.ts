import { verificationQueue } from "@/server/lib/mobile/admin-verification";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/**
 * 本人確認 queue (contract: VerificationQueue): ?tab=pending|needsInfo,
 * ?q= name search, ?page= (20 per page). Committee admins only.
 */
export const GET = mobileRoute(({ request, user, locale }) =>
  verificationQueue(user, query(request), locale),
);
