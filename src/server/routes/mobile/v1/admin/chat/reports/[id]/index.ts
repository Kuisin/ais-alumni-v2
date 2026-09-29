import { z } from "zod";
import { setChatReportClosedAction } from "@/server/app/actions/chat-reports";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({ close: z.boolean() });

/** Mark a chat report done, or open it again. */
export const POST = mobileRoute<{ id: string }>(async ({ request, params }) => {
  const { close } = await readJson(request, Body);
  const fd = new FormData();
  fd.set("id", IdParam.parse(params.id));
  fd.set("close", close ? "1" : "0");
  await setChatReportClosedAction(fd);
  return { ok: true };
});
