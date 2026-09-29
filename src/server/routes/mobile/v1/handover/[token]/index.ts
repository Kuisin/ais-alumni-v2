import type { HandoverInfo } from "@contract/onboarding";
import { getLocale } from "next-intl/server";
import { displayName } from "@/server/lib/format";
import { findHandover } from "@/server/lib/handover";
import { publicRoute } from "@/server/lib/mobile/http";

/**
 * The emailed link for a child taking over the account a parent created
 * (the website's /app/handover/[token]). Public: the link is the proof.
 * Looking it up doesn't use it — confirming is a separate POST.
 */
export const GET = publicRoute(async (request) => {
  const token = decodeURIComponent(
    new URL(request.url).pathname.split("/").at(-1) ?? "",
  );
  const locale = (await getLocale()) === "en" ? "en" : "ja";
  const h = await findHandover(token);
  if (!h) return { valid: false } satisfies HandoverInfo;
  return {
    valid: true,
    parent: displayName(h.parent, locale),
    child: displayName(h.child, locale),
    email: h.email,
  } satisfies HandoverInfo;
});
