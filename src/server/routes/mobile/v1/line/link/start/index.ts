import { verifyLinkState } from "@/server/lib/line-link";
import { linkRedirect, withOutcome } from "@/server/lib/mobile/line-link";
import {
  flowCookieHeader,
  lineAuthorizeUrl,
  lineReady,
  newFlow,
} from "@/server/lib/mobile/oauth";

/**
 * Link LINE, step 2 (opened by the app in a browser): check the signed link
 * state, remember the flow and go to LINE. LINE returns to the sign-in
 * callback (/auth/oauth/callback/line), which sees the link flow. See
 * src/server/lib/mobile/line-link.ts.
 */
export function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams;
  const state = verifyLinkState(q.get("s"));
  const secure = url.protocol === "https:";
  const go = (location: string, cookie?: string) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: location,
        ...(cookie ? { "Set-Cookie": flowCookieHeader(cookie, secure) } : {}),
        "Cache-Control": "no-store",
      },
    });
  if (!state) {
    // Expired or tampered: back to where the app asked, if we can tell.
    const to = linkRedirect(q.get("redirect"), "/", url.origin);
    return go(withOutcome(to, "expired"));
  }
  const redirect = linkRedirect(q.get("redirect"), state.r, url.origin);
  if (!lineReady()) return go(withOutcome(redirect, "error"));
  const { flow, cookie } = newFlow("", redirect, state.l, state.u);
  return go(lineAuthorizeUrl(flow, url.origin), cookie);
}
