import { mobileRoute } from "@/server/lib/mobile/http";
import { meFor } from "@/server/lib/mobile/me";

/** The signed-in account, in any state (the app routes by `user.state`). */
export const GET = mobileRoute(({ user }) => meFor(user), "user");
