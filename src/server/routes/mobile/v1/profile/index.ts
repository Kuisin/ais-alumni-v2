import { loadMyProfile } from "@/server/lib/mobile/account";
import { mobileRoute } from "@/server/lib/mobile/http";

/** My profile, read-only (the website's /app/profile) → MyProfile. */
export const GET = mobileRoute(({ user, locale }) =>
  loadMyProfile(user, locale),
);
