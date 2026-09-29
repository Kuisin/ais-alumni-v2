import { ApiError, mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  pushState,
  RegisterBody,
  registerDevice,
  unregisterDevice,
} from "@/server/lib/mobile/notifications";
import { sessionFromRequest } from "@/server/lib/mobile/tokens";

/**
 * This device's app notifications. Any signed-in account (applicants too:
 * they hear when their application is decided).
 */
async function session(request: Request) {
  const s = await sessionFromRequest(request);
  if (!s) throw new ApiError(401, "unauthenticated");
  return s;
}

export const GET = mobileRoute(
  async ({ request }) => pushState(await session(request)),
  "user",
);

export const PUT = mobileRoute(
  async ({ request }) =>
    registerDevice(
      await session(request),
      await readJson(request, RegisterBody),
    ),
  "user",
);

export const DELETE = mobileRoute(
  async ({ request }) => unregisterDevice(await session(request)),
  "user",
);
