import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  HistoryBody,
  loadHistoryEditor,
  saveHistory,
} from "@/server/lib/mobile/profile";

/** 学歴・職歴 (the website's /app/profile/history) → HistoryEditor. */
export const GET = mobileRoute(({ user, locale }) =>
  loadHistoryEditor(user, locale),
);

/** Add or edit one of my entries: HistoryInput → FormOk ("history"). */
export const POST = mobileRoute(async ({ request }) =>
  saveHistory(await readJson(request, HistoryBody)),
);
