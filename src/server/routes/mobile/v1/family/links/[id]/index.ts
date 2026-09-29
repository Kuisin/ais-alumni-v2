import { removeLink } from "@/server/lib/mobile/family";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** Decline a request to me, or cancel one I sent (pending only). */
export const DELETE = mobileRoute<{ id: string }>(({ user, params }) =>
  removeLink(user, IdParam.parse(params.id)),
);
