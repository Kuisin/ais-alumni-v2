import { z } from "zod";
import {
  deleteBroadcastAction,
  editBroadcastAction,
} from "@/server/app/actions/broadcasts";
import { sentMessage } from "@/server/lib/mobile/admin/notify";
import {
  IdParam,
  mobileRoute,
  notFound,
  readJson,
} from "@/server/lib/mobile/http";

/** A sent message and who has read it (its sender or an admin). */
export const GET = mobileRoute<{ id: string }>(({ user, params, locale }) =>
  sentMessage(user, params.id, locale),
);

const Edit = z.object({
  title: z.string().max(1000),
  body: z.string().max(10000),
});

/** Edit the title / body (recipients see 「編集済み」; no new notification). */
export const PATCH = mobileRoute<{ id: string }>(
  async ({ request, params }) => {
    const id = IdParam.safeParse(params.id);
    if (!id.success) throw notFound();
    const b = await readJson(request, Edit);
    const fd = new FormData();
    fd.set("id", id.data);
    fd.set("title", b.title);
    fd.set("body", b.body);
    return await editBroadcastAction(null, fd);
  },
);

/** Delete permanently, with its read receipts (its sender or an admin). */
export const DELETE = mobileRoute<{ id: string }>(async ({ params }) => {
  const id = IdParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const fd = new FormData();
  fd.set("id", id.data);
  if (!(await deleteBroadcastAction(fd))) throw notFound();
  return { ok: true };
});
