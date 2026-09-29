import { claimFamily } from "@/server/lib/mobile/family";
import { mobileRoute } from "@/server/lib/mobile/http";

/**
 * {direction, otherId}: 「この人は私の子ども（保護者）です」 (contract:
 * FamilyClaimResult; errors family.errors.<code>).
 */
export const POST = mobileRoute(async ({ request, user }) =>
  claimFamily(user, await request.json().catch(() => null)),
);
