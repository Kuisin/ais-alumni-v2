import { z } from "zod";
import { renameOrgAction } from "@/server/app/actions/admin-orgs";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({
  kind: z.enum(["school", "company"]),
  id: z.string().min(1).max(64),
  name: z.string().max(500),
});

/** Rename a school / company → AdminFormResult (key in "organizations"). */
export const POST = mobileRoute(async ({ request }) => {
  const body = await readJson(request, Body);
  const fd = new FormData();
  fd.set("kind", body.kind);
  fd.set("id", body.id);
  fd.set("name", body.name);
  return (await renameOrgAction(null, fd)) ?? {};
});
