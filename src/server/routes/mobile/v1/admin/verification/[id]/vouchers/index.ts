import { z } from "zod";
import {
  addVoucher,
  voucherCandidates,
} from "@/server/lib/mobile/admin-verification";
import {
  IdParam,
  mobileRoute,
  query,
  readJson,
} from "@/server/lib/mobile/http";

/** Members to ask about the applicant, by name (?q=; VoucherCandidate[]). */
export const GET = mobileRoute<{ id: string }>(
  ({ request, user, params, locale }) =>
    voucherCandidates(user, IdParam.parse(params.id), query(request).q, locale),
);

/** Ask a member (contract: VerificationActionResult). */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    const { voucherId } = await readJson(
      request,
      z.object({ voucherId: IdParam }),
    );
    return addVoucher(user, IdParam.parse(params.id), voucherId);
  },
);
