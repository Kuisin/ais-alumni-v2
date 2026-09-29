import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { withdrawRequest } from "@/server/lib/mobile/profile";

/** Withdraw my pending request. */
export const DELETE = mobileRoute<{ id: string }>(({ params }) =>
  withdrawRequest("name", IdParam.parse(params.id)),
);
