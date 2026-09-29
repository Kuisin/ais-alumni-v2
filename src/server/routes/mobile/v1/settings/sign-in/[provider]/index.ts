import { z } from "zod";
import { mobileRoute } from "@/server/lib/mobile/http";
import { removeSignInMethod } from "@/server/lib/mobile/settings";

const Provider = z.enum(["google", "line"]);

/** 設定 → ログイン方法 → 解除 → SettingsResult (never the last method). */
export const DELETE = mobileRoute<{ provider: string }>(async ({ params }) =>
  removeSignInMethod(Provider.parse(params.provider)),
);
