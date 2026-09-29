import { approveNewsAction } from "@/server/app/actions/admin-content";
import { IdParam, mobileRoute, notFound } from "@/server/lib/mobile/http";

/** Approve a 同窓会委員's post (another 同窓会委員 or an admin, never the author). */
export const POST = mobileRoute<{ id: string }>(async ({ params }) => {
  const id = IdParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const fd = new FormData();
  fd.set("id", id.data);
  return { ok: true, path: await approveNewsAction(fd) };
});
