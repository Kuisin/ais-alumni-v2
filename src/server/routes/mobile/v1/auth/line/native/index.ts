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
import {
  lineIdentityFromAccessToken,
  lineReady,
  memberForLine,
} from "@/server/lib/mobile/oauth";
import { createMobileSession } from "@/server/lib/mobile/tokens";

const Body = z.object({
  accessToken: z.string().min(1).max(2000),
  locale: z.enum(["ja", "en"]).catch("ja"),
  device: DeviceSchema,
});

/**
 * LINE sign-in in the native app (LINE SDK: opens the LINE app, or LINE's
 * login screen): the app sends the access token it got; we check it was
 * issued to our channel, then find or create the member exactly as the
 * browser sign-in does (memberForLine) and start a device session.
 */
export const POST = publicRoute(async (request): Promise<SessionResult> => {
  if (!lineReady()) throw new ApiError(404, "unavailable");
  const body = await readJson(request, Body);
  const identity = await lineIdentityFromAccessToken(body.accessToken);
  if (!identity) throw new ApiError(400, "invalid_token");
  const userId = await memberForLine(identity, body.locale);
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: true },
  });
  const token = await createMobileSession(user.id, body.device);
  return { token, me: await meFor(user) };
});
