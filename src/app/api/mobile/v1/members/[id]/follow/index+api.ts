import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { followMember, unfollowMember } from "@/server/lib/mobile/people";

/** Follow (sends a request, or follows when auto-accepted): FollowResult. */
export const POST = mobileRoute<{ id: string }>(({ user, params }) =>
  followMember(user, IdParam.parse(params.id)),
);

/** Unfollow, or cancel my pending request. */
export const DELETE = mobileRoute<{ id: string }>(({ user, params }) =>
  unfollowMember(user, IdParam.parse(params.id)),
);
