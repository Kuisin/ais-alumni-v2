import { revokeInvite } from "@/server/lib/mobile/family";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** Cancel one of my unused invitations (contract: Ok). */
export const POST = mobileRoute<{ id: string }>(({ user, params }) =>
  revokeInvite(user, IdParam.parse(params.id)),
);
