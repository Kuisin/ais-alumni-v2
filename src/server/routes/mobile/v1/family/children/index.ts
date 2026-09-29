import { claimChildByName } from "@/server/lib/mobile/family";
import { mobileRoute } from "@/server/lib/mobile/http";

/**
 * {childName, cohortNumber, leftYear}: a child without an account, confirmed
 * by an admin (contract: FamilyClaimResult; errors family.errors.<code>).
 */
export const POST = mobileRoute(async ({ request, user }) =>
  claimChildByName(user, await request.json().catch(() => null)),
);
