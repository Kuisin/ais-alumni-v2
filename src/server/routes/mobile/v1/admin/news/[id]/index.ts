import { deleteNewsAction } from "@/server/app/actions/admin-content";
import { adminNewsDetail } from "@/server/lib/mobile/admin/news";
import { IdParam, mobileRoute, notFound } from "@/server/lib/mobile/http";

/** One post as its admin page shows it (authors: their own; 同窓会委員: ones to approve). */
export const GET = mobileRoute<{ id: string }>(({ user, params, locale }) =>
  adminNewsDetail(user, params.id, locale),
);

/** Delete the post (admins, or its author — the action checks). */
export const DELETE = mobileRoute<{ id: string }>(async ({ params }) => {
  const id = IdParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const fd = new FormData();
  fd.set("id", id.data);
  return { ok: true, path: await deleteNewsAction(fd) };
});
