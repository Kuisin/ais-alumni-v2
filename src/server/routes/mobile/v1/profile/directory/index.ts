import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { saveDirectory } from "@/server/lib/mobile/profile";

const Body = z.object({ listed: z.boolean() });

/** 会員名簿に表示する (parents only; the action checks): → FormOk. */
export const PUT = mobileRoute(async ({ request }) =>
  saveDirectory((await readJson(request, Body)).listed),
);
