import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { deleteAccount } from "@/server/lib/mobile/settings";

const Body = z.object({ confirmWord: z.string().max(100) });

/**
 * 設定 → アカウントの削除 (APPI; in-app deletion for the App Store) →
 * SettingsResult. The confirmation word of either language is accepted.
 * Any signed-in account, so one still in registration can be deleted too.
 */
export const POST = mobileRoute(async ({ request }) => {
  const { confirmWord } = await readJson(request, Body);
  return deleteAccount(confirmWord);
}, "user");
