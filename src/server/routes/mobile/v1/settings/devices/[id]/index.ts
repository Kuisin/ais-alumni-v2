import { signOutDevice } from "@/server/lib/mobile/account";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/**
 * Sign out one of my other devices → { ok: true }. 404 for anything that
 * isn't my session; 400 current_device for this one (use /auth/signout).
 */
export const DELETE = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    await signOutDevice(user, request, IdParam.parse(params.id));
    return { ok: true };
  },
);
