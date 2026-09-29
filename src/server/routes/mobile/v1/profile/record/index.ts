import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  loadRecordPage,
  RecordBody,
  submitRecordRequest,
} from "@/server/lib/mobile/profile";

/** 在校記録 (the website's /app/profile/record) → RecordPage. */
export const GET = mobileRoute(({ user, locale }) =>
  loadRecordPage(user, locale),
);

/** Ask for a correction: RecordRequestInput → FormOk ("records"). */
export const POST = mobileRoute(async ({ request }) =>
  submitRecordRequest(await readJson(request, RecordBody)),
);
