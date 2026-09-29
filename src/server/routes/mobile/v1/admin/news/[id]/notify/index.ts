import { notifyNewsAction } from "@/server/app/actions/admin-content";
import { adminNewsNotifyEstimate } from "@/server/lib/mobile/admin/news";
import { IdParam, mobileRoute, notFound } from "@/server/lib/mobile/http";

/** 通知内容の確認: recipients and LINE / email / app counts. */
export const GET = mobileRoute<{ id: string }>(({ user, params }) =>
  adminNewsNotifyEstimate(user, params.id),
);

/** Confirmed 公開して通知: publishes now if needed, then notifies once. */
export const POST = mobileRoute<{ id: string }>(async ({ params }) => {
  const id = IdParam.safeParse(params.id);
  if (!id.success) throw notFound();
  const fd = new FormData();
  fd.set("id", id.data);
  return { ok: true, path: await notifyNewsAction(fd) };
});
