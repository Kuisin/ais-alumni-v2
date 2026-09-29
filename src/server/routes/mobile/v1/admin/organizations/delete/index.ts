import { z } from "zod";
import { deleteOrgAction } from "@/server/app/actions/admin-orgs";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({
  kind: z.enum(["school", "company"]),
  id: z.string().min(1).max(64),
});

/** Delete an entry nobody uses (the action ignores ones in use). */
export const POST = mobileRoute(async ({ request }) => {
  const { kind, id } = await readJson(request, Body);
  await deleteOrgAction(kind, id);
  return { ok: true };
});
