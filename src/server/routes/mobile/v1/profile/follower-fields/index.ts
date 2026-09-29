import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { saveFollowerFields } from "@/server/lib/mobile/profile";

// Unknown fields are dropped by the action (isPersonalField).
const Body = z.object({ shared: z.array(z.string().max(40)).max(40) });

/** フォロワーに公開する項目: FollowerFieldsUpdate → FormOk. */
export const PUT = mobileRoute(async ({ request }) =>
  saveFollowerFields((await readJson(request, Body)).shared),
);
