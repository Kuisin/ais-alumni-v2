import { z } from "zod";
import { saveDirectRulesAction } from "@/server/app/actions/chat-reports";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({
  rules: z.record(z.string().max(40), z.string().max(40)),
});

/** Who each member type may have 1:1 talks with → { ok } | { error }. */
export const PUT = mobileRoute(async ({ request }) => {
  const { rules } = await readJson(request, Body);
  const fd = new FormData();
  for (const [role, rule] of Object.entries(rules))
    fd.set(`rule.${role}`, rule);
  return (await saveDirectRulesAction(null, fd)) ?? {};
});
