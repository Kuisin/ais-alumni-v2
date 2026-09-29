import { z } from "zod";
import { AccountState } from "@/server/generated/prisma/enums";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { confirmEmailCode, inState } from "@/server/lib/mobile/onboarding";

const Body = z.object({
  email: z.string().max(300),
  code: z.string().max(20),
});

/**
 * Confirm the code: the account moves on (or is merged into the member who
 * already has this address); /me then says where it goes next.
 */
export const POST = mobileRoute(async ({ request }) => {
  const user = await inState(AccountState.UNVERIFIED_EMAIL);
  const body = await readJson(request, Body);
  await confirmEmailCode(user, body.email, body.code);
  return { ok: true as const };
}, "user");
