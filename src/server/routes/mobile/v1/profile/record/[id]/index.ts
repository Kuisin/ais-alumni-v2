import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { cancelRecordRequest } from "@/server/lib/mobile/profile";

/** Withdraw my pending correction request. */
export const DELETE = mobileRoute<{ id: string }>(({ params }) =>
  cancelRecordRequest(IdParam.parse(params.id)),
);
