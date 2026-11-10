import { mobileRoute } from "@/server/lib/mobile/http";
import { acknowledgeWarning } from "@/server/lib/sanctions";

/** 警告 → 「確認しました」: the warning is no longer shown (/me). */
export const POST = mobileRoute(async ({ user }) => {
  await acknowledgeWarning(user.id);
  return { ok: true };
}, "user");
