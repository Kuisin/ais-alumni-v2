import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { savePhotoVisibility } from "@/server/lib/mobile/profile";

const Body = z.object({ public: z.boolean() });

/** 写真を全員に公開: PhotoVisibilityUpdate → FormOk. */
export const PUT = mobileRoute(async ({ request }) =>
  savePhotoVisibility((await readJson(request, Body)).public),
);
