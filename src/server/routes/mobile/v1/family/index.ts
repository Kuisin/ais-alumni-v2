import { familyPage } from "@/server/lib/mobile/family";
import { mobileRoute } from "@/server/lib/mobile/http";

/** 家族 (the website's /app/family; contract: FamilyPage). */
export const GET = mobileRoute(({ user, locale }) => familyPage(user, locale));
