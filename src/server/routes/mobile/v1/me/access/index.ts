import { myAccess } from "@/server/lib/mobile/access";
import { mobileRoute } from "@/server/lib/mobile/http";

/**
 * 利用できる機能: the member's types, positions and rules (contract:
 * MyAccess). Any signed-in account — one still registering sees the types
 * it applied as.
 */
export const GET = mobileRoute(
  ({ user, locale }) => myAccess(user, locale === "en" ? "en" : "ja"),
  "user",
);
