import type { EmailCodeSent } from "@contract/onboarding";
import { z } from "zod";
import { AccountState } from "@/server/generated/prisma/enums";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { inState, requestEmailCode } from "@/server/lib/mobile/onboarding";

const Body = z.object({
  email: z.string().max(300),
  resend: z.boolean().optional(),
});

/** LINE-first accounts: send a code to confirm an email (/app/onboarding/email). */
export const POST = mobileRoute(async ({ request }) => {
  const user = await inState(AccountState.UNVERIFIED_EMAIL);
  const body = await readJson(request, Body);
  return (await requestEmailCode(
    user,
    body.email,
    Boolean(body.resend),
  )) satisfies EmailCodeSent;
}, "user");
