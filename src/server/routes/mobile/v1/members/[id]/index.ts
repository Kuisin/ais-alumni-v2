import { IdParam, mobileRoute, query } from "@/server/lib/mobile/http";
import { memberProfile } from "@/server/lib/mobile/people";

/**
 * A member's profile as the viewer may see it (contract: MemberProfile);
 * ?as=members|followers|family previews my own profile.
 */
export const GET = mobileRoute<{ id: string }>(
  ({ request, user, params, locale }) =>
    memberProfile(user, IdParam.parse(params.id), query(request).as, locale),
);
