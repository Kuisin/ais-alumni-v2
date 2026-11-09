import type { AdminSanctions } from "@contract/admin-members";
import { adminOnly } from "@/server/lib/mobile/admin";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { liftSanction, sanctionsFor } from "@/server/lib/sanctions";

/** 処分を解除 (admins) → the member's AdminSanctions. */
export const POST = mobileRoute<{ id: string }>(
  async ({ user, params }): Promise<AdminSanctions> => {
    adminOnly(user);
    const s = await liftSanction(user, IdParam.parse(params.id));
    return sanctionsFor(s.userId);
  },
);
