import { z } from "zod";
import { setNewsArchivedAction } from "@/server/app/actions/admin-content";
import {
  IdParam,
  mobileRoute,
  notFound,
  readJson,
} from "@/server/lib/mobile/http";

const Body = z.object({ archive: z.boolean() });

/** Archive the post (hidden from members, never notified) or restore it. */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) => {
  const id = IdParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const { archive } = await readJson(request, Body);
  const fd = new FormData();
  fd.set("id", id.data);
  fd.set("archive", archive ? "1" : "0");
  await setNewsArchivedAction(fd);
  return { ok: true, path: null };
});
