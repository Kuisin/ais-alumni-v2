import { confirmLink } from "@/server/lib/mobile/family";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** 「承認」 a family link addressed to me (contract: Ok). */
export const POST = mobileRoute<{ id: string }>(({ user, params }) =>
  confirmLink(user, IdParam.parse(params.id)),
);
