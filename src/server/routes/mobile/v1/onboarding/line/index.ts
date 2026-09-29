import type { OnboardingLine } from "@contract/onboarding";
import { AccountState } from "@/server/generated/prisma/enums";
import { mobileRoute } from "@/server/lib/mobile/http";
import { inState, lineStep } from "@/server/lib/mobile/onboarding";

/**
 * The optional 「LINE で最新情報を受け取る」 step (/app/onboarding/line).
 * `line: null`: nothing left to do here (seen, or linked and following) —
 * /me moves on to the application.
 */
export const GET = mobileRoute(async () => {
  const user = await inState(AccountState.EMAIL_VERIFIED);
  return { line: await lineStep(user) } satisfies {
    line: OnboardingLine | null;
  };
}, "user");
