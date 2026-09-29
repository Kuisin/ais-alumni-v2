import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { deactivate } from "@/server/lib/mobile/settings";

const Body = z.object({ confirm: z.literal("yes") });

/** 設定 → アカウントの停止 → SettingsResult; ok signs this device out. */
export const POST = mobileRoute(async ({ request }) => {
  await readJson(request, Body);
  return deactivate(request);
});
