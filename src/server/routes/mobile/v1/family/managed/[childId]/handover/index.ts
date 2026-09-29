import { z } from "zod";
import {
  cancelChildHandover,
  startChildHandover,
} from "@/server/lib/mobile/family";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({ email: z.string().max(300) });

/**
 * {email}: send the handover link to a child account I manage (contract:
 * Ok; errors family.handover.errors.<code>).
 */
export const POST = mobileRoute<{ childId: string }>(
  async ({ request, user, params }) =>
    startChildHandover(
      user,
      IdParam.parse(params.childId),
      (await readJson(request, Body)).email,
    ),
);

/** Cancel the pending handover link. */
export const DELETE = mobileRoute<{ childId: string }>(({ user, params }) =>
  cancelChildHandover(user, IdParam.parse(params.childId)),
);
