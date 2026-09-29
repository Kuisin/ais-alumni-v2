import { z } from "zod";
import {
  checkInMemberAction,
  checkInTicketAction,
} from "@/server/app/actions/check-in";
import { checkInBoard } from "@/server/lib/mobile/check-in";
import {
  IdParam,
  mobileRoute,
  notFound,
  readJson,
} from "@/server/lib/mobile/http";

/** The check-in screen's list (contract: CheckInBoard); staff only. */
export const GET = mobileRoute<{ id: string }>(({ user, params, locale }) => {
  if (!IdParam.safeParse(params.id).success) throw notFound();
  return checkInBoard(user, params.id, locale);
});

const Body = z.union([
  z.object({ ticket: z.string().max(2000) }),
  z.object({ userId: z.string().max(64) }),
]);

/**
 * Check someone in: a scanned QR ticket (link or code) or a member picked
 * from the list — the website's actions (staff and ticket checks there).
 */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) => {
  const body = await readJson(request, Body);
  return "ticket" in body
    ? checkInTicketAction(params.id, body.ticket)
    : checkInMemberAction(params.id, body.userId);
});
