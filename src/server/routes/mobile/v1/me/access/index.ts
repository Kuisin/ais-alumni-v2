import { myAccess } from "@/server/lib/mobile/access";
import { mobileRoute } from "@/server/lib/mobile/http";

/** 利用できる機能: the member's types, positions and rules (contract: MyAccess). */
export const GET = mobileRoute(({ user, locale }) =>
  myAccess(user, locale === "en" ? "en" : "ja"),
);
