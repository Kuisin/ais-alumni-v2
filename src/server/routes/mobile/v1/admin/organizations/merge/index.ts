import { z } from "zod";
import { mergeOrgAction } from "@/server/app/actions/admin-orgs";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({
  kind: z.enum(["school", "company"]),
  id: z.string().min(1).max(64),
  targetId: z.string().max(64),
});

/**
 * Merge a duplicate into another entry (its members move there, it is
 * deleted) → AdminFormResult (key in "organizations").
 */
export const POST = mobileRoute(async ({ request }) => {
  const body = await readJson(request, Body);
  const fd = new FormData();
  fd.set("kind", body.kind);
  fd.set("id", body.id);
  fd.set(`${body.kind}Id`, body.targetId);
  return (await mergeOrgAction(null, fd)) ?? {};
});
