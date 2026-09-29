import { adminTeachers } from "@/server/lib/mobile/admin-teachers";
import { mobileRoute } from "@/server/lib/mobile/http";

/** 教職員: current teachers, candidates for ?q= (contract: AdminTeachers). */
export const GET = mobileRoute(({ user, request, locale }) =>
  adminTeachers(user, new URL(request.url).searchParams.get("q") ?? "", locale),
);
