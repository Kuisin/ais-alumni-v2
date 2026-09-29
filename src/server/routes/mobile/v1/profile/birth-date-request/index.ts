import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  BirthDateRequestBody,
  submitBirthDateRequest,
} from "@/server/lib/mobile/profile";

/** Ask to add or correct my birth date: BirthDateRequestInput → FormOk ("profile"). */
export const POST = mobileRoute(async ({ request }) =>
  submitBirthDateRequest(await readJson(request, BirthDateRequestBody)),
);
