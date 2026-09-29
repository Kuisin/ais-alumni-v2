import { z } from "zod";
import {
  diagnoseSignInCode,
  userForSignInCode,
} from "@/server/lib/auth/email-sign-in";
import { normalizeEmail } from "@/server/lib/auth/otp";
import { db } from "@/server/lib/db";
import type { SessionResult } from "@/server/lib/mobile/contract/core";
import {
  ApiError,
  DeviceSchema,
  publicRoute,
  readJson,
} from "@/server/lib/mobile/http";
import { meFor } from "@/server/lib/mobile/me";
import { createMobileSession } from "@/server/lib/mobile/tokens";

const Body = z.object({
  email: z.email().max(254),
  code: z.string().max(20),
  locale: z.enum(["ja", "en"]).catch("ja"),
  device: DeviceSchema,
});

/** Email sign-in, step 2: check the code and start a device session. */
export const POST = publicRoute(async (request): Promise<SessionResult> => {
  const body = await readJson(request, Body);
  const email = normalizeEmail(body.email);
  const code = body.code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, "invalid_code_format");
  // Precise message for expired / locked codes without consuming anything.
  const pre = await diagnoseSignInCode(email);
  if (pre === "expired" || pre === "too_many_attempts")
    throw new ApiError(400, pre);
  const found = await userForSignInCode({ email, code, locale: body.locale });
  if (!found) throw new ApiError(400, await diagnoseSignInCode(email));
  const user = await db.user.findUniqueOrThrow({
    where: { id: found.id },
    include: { roles: true },
  });
  const token = await createMobileSession(user.id, body.device);
  return { token, me: await meFor(user) };
});
