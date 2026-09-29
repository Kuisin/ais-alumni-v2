import { verificationDetail } from "@/server/lib/mobile/admin-verification";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** One application (contract: VerificationDetail). Committee admins only. */
export const GET = mobileRoute<{ id: string }>(({ user, params, locale }) =>
  verificationDetail(user, IdParam.parse(params.id), locale),
);
