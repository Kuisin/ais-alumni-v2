import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { blockMember, unblockMember } from "@/server/lib/mobile/people";

/** Block: hides both members from each other and removes their follows. */
export const POST = mobileRoute<{ id: string }>(({ user, params }) =>
  blockMember(user, IdParam.parse(params.id)),
);

/** Unblock. */
export const DELETE = mobileRoute<{ id: string }>(({ user, params }) =>
  unblockMember(user, IdParam.parse(params.id)),
);
