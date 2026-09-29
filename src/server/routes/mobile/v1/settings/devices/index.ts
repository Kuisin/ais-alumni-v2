import { listDevices, signOutOtherDevices } from "@/server/lib/mobile/account";
import { mobileRoute } from "@/server/lib/mobile/http";

/** Devices signed in to the app with my account → DeviceList. */
export const GET = mobileRoute(({ request, user }) =>
  listDevices(user, request),
);

/** Sign out every other device → { removed }. */
export const DELETE = mobileRoute(async ({ request, user }) => ({
  removed: await signOutOtherDevices(user, request),
}));
