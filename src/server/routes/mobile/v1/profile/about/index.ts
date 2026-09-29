import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { AboutBody, saveAbout } from "@/server/lib/mobile/profile";

/** 自己紹介・連絡先 (the website's ProfileForm): AboutUpdate → FormOk. */
export const PUT = mobileRoute(async ({ request, user }) =>
  saveAbout(user, await readJson(request, AboutBody)),
);
