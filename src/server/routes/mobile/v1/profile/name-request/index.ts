import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  NameRequestBody,
  submitNameRequest,
} from "@/server/lib/mobile/profile";

/** Ask the committee to change my name: NameRequestInput → FormOk ("profile"). */
export const POST = mobileRoute(async ({ request }) =>
  submitNameRequest(await readJson(request, NameRequestBody)),
);
