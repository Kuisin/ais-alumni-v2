import type { HandoverClaimed } from "@contract/onboarding";
import { claimHandover } from "@/server/lib/handover";
import { ApiError, publicRoute } from "@/server/lib/mobile/http";

/**
 * Confirm the handover (no sign-in needed: the emailed link proves the
 * address is the child's). 400 `invalid` when used, expired or unknown.
 */
export const POST = publicRoute(async (request) => {
  const parts = new URL(request.url).pathname.split("/");
  const token = decodeURIComponent(parts.at(-2) ?? "");
  const r = await claimHandover(token);
  if (!r.ok) throw new ApiError(400, "invalid");
  return { email: r.email, merged: r.merged } satisfies HandoverClaimed;
});
