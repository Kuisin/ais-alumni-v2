import { z } from "zod";
import { decideRecordRequest } from "@/server/lib/mobile/admin-requests";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

// The note's rules (required to reject, 1000 max) are the action's.
const Body = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(10_000),
});

/** Approve (apply to the record) or reject a 在籍情報 request. */
export const POST = mobileRoute<{ id: string }>(
  async ({ user, request, params }) => {
    const { decision, note } = await readJson(request, Body);
    return decideRecordRequest(user, params.id, decision, note);
  },
);
