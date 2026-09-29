import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { acceptRequest } from "@/server/lib/mobile/people";

/** Accept a follow request sent to me (contract: AcceptResult). */
export const POST = mobileRoute<{ followId: string }>(({ user, params }) =>
  acceptRequest(user, IdParam.parse(params.followId)),
);
