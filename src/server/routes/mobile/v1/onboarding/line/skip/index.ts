import { AccountState } from "@/server/generated/prisma/enums";
import { mobileRoute } from "@/server/lib/mobile/http";
import { inState, skipLine } from "@/server/lib/mobile/onboarding";

/** 「スキップ」 / 「次へ」 on the LINE step: remembered; on to the application. */
export const POST = mobileRoute(async () => {
  const user = await inState(AccountState.EMAIL_VERIFIED);
  await skipLine(user);
  return { ok: true as const };
}, "user");
