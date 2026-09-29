import { z } from "zod";
import { previewNewsAudienceAction } from "@/server/app/actions/admin-content";
import { forbidden, mobileRoute, readJson } from "@/server/lib/mobile/http";

/** How many ACTIVE members an audience reaches (contract: AudienceCount). */
export const POST = mobileRoute(async ({ request }) => {
  // Checked by the action (audienceSpecSchema, the author's scope).
  const spec = await readJson(request, z.unknown());
  const r = await previewNewsAudienceAction(spec);
  if (!r) throw forbidden();
  return r;
});
