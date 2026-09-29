import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { GenderSetBody, setGenderOnce } from "@/server/lib/mobile/profile";

/** No gender recorded yet: set it once (GenderSetInput) → FormOk ("profile"). */
export const POST = mobileRoute(async ({ request }) =>
  setGenderOnce((await readJson(request, GenderSetBody)).gender),
);
