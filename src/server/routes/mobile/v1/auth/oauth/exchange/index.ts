import type { SessionResult } from "@contract/core";
import { z } from "zod";
import { db } from "@/server/lib/db";
import {
  ApiError,
  DeviceSchema,
  publicRoute,
  readJson,
} from "@/server/lib/mobile/http";
import { meFor } from "@/server/lib/mobile/me";
import { redeemHandoffCode } from "@/server/lib/mobile/oauth";
import {
  createMobileSession,
  HandoffReplayError,
} from "@/server/lib/mobile/tokens";

const Body = z.object({
  code: z.string().max(1000),
  verifier: z.string().max(128),
  device: DeviceSchema,
});

/**
 * LINE sign-in, step 3: the app trades the code for a session. A code works
 * once; using it again also ends the session it started.
 */
export const POST = publicRoute(async (request): Promise<SessionResult> => {
  const body = await readJson(request, Body);
  const redeemed = redeemHandoffCode(body.code, body.verifier);
  if (!redeemed) throw new ApiError(400, "invalid_code");
  const user = await db.user.findUnique({
    where: { id: redeemed.userId },
    include: { roles: true },
  });
  if (!user) throw new ApiError(400, "invalid_code");
  let token: string;
  try {
    token = await createMobileSession(user.id, body.device, redeemed.jti);
  } catch (e) {
    if (e instanceof HandoffReplayError)
      throw new ApiError(400, "invalid_code");
    throw e;
  }
  return { token, me: await meFor(user) };
});
