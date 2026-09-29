import type { OnboardingStatus } from "@contract/onboarding";
import { AccountState } from "@/server/generated/prisma/enums";
import { mobileRoute } from "@/server/lib/mobile/http";
import { inState, statusFor } from "@/server/lib/mobile/onboarding";

/**
 * Where the application stands (the website's /app/onboarding/status):
 * PENDING_REVIEW, REJECTED and DEACTIVATED accounts.
 */
export const GET = mobileRoute(async () => {
  const user = await inState(
    AccountState.PENDING_REVIEW,
    AccountState.REJECTED,
    AccountState.DEACTIVATED,
  );
  return (await statusFor(user)) satisfies OnboardingStatus;
}, "user");
