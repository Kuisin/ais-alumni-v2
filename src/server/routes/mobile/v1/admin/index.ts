import { adminHome } from "@/server/lib/mobile/admin";
import { mobileRoute } from "@/server/lib/mobile/http";

/** 管理モード home: work waiting (contract: AdminHome). Staff only. */
export const GET = mobileRoute(({ user }) => adminHome(user));
