import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  GenderRequestBody,
  submitGenderRequest,
} from "@/server/lib/mobile/profile";

/** Ask to change my gender: GenderRequestInput → FormOk ("profile"). */
export const POST = mobileRoute(async ({ request }) =>
  submitGenderRequest(await readJson(request, GenderRequestBody)),
);
