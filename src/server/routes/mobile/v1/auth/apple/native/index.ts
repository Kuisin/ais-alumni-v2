import type { SessionResult } from "@contract/core";
import { z } from "zod";
import { db } from "@/server/lib/db";
import {
  appleIdentity,
  keepAppleToken,
  memberForApple,
} from "@/server/lib/mobile/apple";
import {
  ApiError,
  DeviceSchema,
  publicRoute,
  readJson,
} from "@/server/lib/mobile/http";
import { meFor } from "@/server/lib/mobile/me";
import { createMobileSession } from "@/server/lib/mobile/tokens";

const Body = z.object({
  identityToken: z.string().min(1).max(5000),
  nonce: z.string().min(16).max(200),
  /** one-time code for a refresh token (revoked when the account is deleted) */
  authorizationCode: z.string().max(2000).optional(),
  /** the name iOS gave (first sign-in only) */
  fullName: z
    .object({
      givenName: z.string().max(200).nullish(),
      middleName: z.string().max(200).nullish(),
      familyName: z.string().max(200).nullish(),
    })
    .nullish()
    .catch(null),
  locale: z.enum(["ja", "en"]).catch("ja"),
  device: DeviceSchema,
});

/**
 * Sign in with Apple in the iOS app: the identity token iOS gave the app
 * and the nonce it asked with. We check Apple signed it for us, find or
 * create the member (src/server/lib/mobile/apple.ts) and start a device
 * session.
 */
export const POST = publicRoute(async (request): Promise<SessionResult> => {
  const body = await readJson(request, Body);
  const identity = await appleIdentity(body.identityToken, body.nonce);
  if (!identity) throw new ApiError(400, "invalid_token");
  const userId = await memberForApple(
    identity,
    body.locale,
    body.fullName ?? null,
  );
  if (body.authorizationCode)
    await keepAppleToken(identity.sub, body.authorizationCode);
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: true },
  });
  const token = await createMobileSession(user.id, body.device);
  return { token, me: await meFor(user) };
});
