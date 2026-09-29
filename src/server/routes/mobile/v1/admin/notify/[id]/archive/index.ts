import { z } from "zod";
import { setBroadcastArchivedAction } from "@/server/app/actions/broadcasts";
import {
  IdParam,
  mobileRoute,
  notFound,
  readJson,
} from "@/server/lib/mobile/http";

const Body = z.object({ archive: z.boolean() });

/** Archive a sent message (hidden from recipients) or restore it. */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) => {
  const id = IdParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const { archive } = await readJson(request, Body);
  const fd = new FormData();
  fd.set("id", id.data);
  fd.set("archive", archive ? "1" : "0");
  if (!(await setBroadcastArchivedAction(fd))) throw notFound();
  return { ok: true };
});
