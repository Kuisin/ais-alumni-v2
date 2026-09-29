import { z } from "zod";
import { setNewsClosedAction } from "@/server/app/actions/admin-content";
import {
  IdParam,
  mobileRoute,
  notFound,
  readJson,
} from "@/server/lib/mobile/http";

const Body = z.object({ close: z.boolean() });

/** Close answers to the post early, or reopen them. */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) => {
  const id = IdParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const { close } = await readJson(request, Body);
  const fd = new FormData();
  fd.set("id", id.data);
  fd.set("close", close ? "1" : "0");
  await setNewsClosedAction(fd);
  return { ok: true, path: null };
});
