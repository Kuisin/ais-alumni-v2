import type { LineLinkStart } from "@contract/line";
import { z } from "zod";
import { ApiError, mobileRoute, readJson } from "@/server/lib/mobile/http";
import { lineLinkStartUrl, linkRedirect } from "@/server/lib/mobile/line-link";
import { ssoReady } from "@/server/lib/sso";

const Body = z.object({
  returnTo: z.string().max(512),
  redirect: z.string().max(300).optional(),
});

/**
 * Link LINE, step 1 (LineLinkRequest → LineLinkStart): a fresh start URL
 * for the signed-in member — any account state, since onboarding links LINE
 * too (the callback refuses deactivated accounts, as the website's does).
 * See src/server/lib/mobile/line-link.ts.
 */
export const POST = mobileRoute(async ({ request, user, locale }) => {
  if (!ssoReady("line")) throw new ApiError(404, "line_unavailable");
  const { returnTo, redirect } = await readJson(request, Body);
  const origin = new URL(request.url).origin;
  const to = linkRedirect(redirect, returnTo, origin);
  return {
    url: lineLinkStartUrl({
      userId: user.id,
      locale,
      origin,
      returnTo,
      redirect: to === redirect ? redirect : undefined,
    }),
    redirect: to,
  } satisfies LineLinkStart;
}, "user");
