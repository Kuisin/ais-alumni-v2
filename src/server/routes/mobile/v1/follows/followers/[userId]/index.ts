import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { removeMyFollower } from "@/server/lib/mobile/people";

/** Remove one of my followers (「削除」). */
export const DELETE = mobileRoute<{ userId: string }>(({ user, params }) =>
  removeMyFollower(user, IdParam.parse(params.userId)),
);
