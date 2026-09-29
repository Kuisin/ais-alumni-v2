import { z } from "zod";
import { broadcastAction } from "@/server/app/actions/broadcasts";
import { notifyPage } from "@/server/lib/mobile/admin/notify";
import { mobileRoute, query, readJson } from "@/server/lib/mobile/http";

/** 一斉通知: the form's options and the send history (?all=1: every sender, admins). */
export const GET = mobileRoute(({ request, user, locale }) =>
  notifyPage(user, query(request).all === "1", locale),
);

const Body = z.object({
  intent: z.enum(["preview", "send"]),
  audience: z.string().max(20),
  roles: z.array(z.string().max(40)).max(20),
  cohortId: z.string().max(64),
  title: z.string().max(1000),
  body: z.string().max(10000),
});

/**
 * Preview (recipient and LINE / email counts) or send, as the website's form
 * posts it to broadcastAction, which checks the right and limits each time.
 */
export const POST = mobileRoute(async ({ request }) => {
  const b = await readJson(request, Body);
  const fd = new FormData();
  fd.set("intent", b.intent);
  fd.set("audience", b.audience);
  for (const r of b.roles) fd.append("roles", r);
  fd.set("cohortId", b.cohortId);
  fd.set("title", b.title);
  fd.set("body", b.body);
  return await broadcastAction(null, fd);
});
