import { z } from "zod";
import { decideNameRequest } from "@/server/lib/mobile/admin-requests";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

// The note's rules (required to reject, 1000 max) are the actions'.
const Body = z.object({
  kind: z.enum(["name", "birthDate", "gender"]),
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(10_000),
});

/** Approve or reject a name / birth date / gender request. */
export const POST = mobileRoute<{ id: string }>(
  async ({ user, request, params }) =>
    decideNameRequest(user, params.id, await readJson(request, Body)),
);
