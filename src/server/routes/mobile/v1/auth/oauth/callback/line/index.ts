import type { LineLinkOutcome } from "@contract/line";
import { linkLine, withOutcome } from "@/server/lib/mobile/line-link";
import {
  APP_REDIRECT,
  createHandoffCode,
  FLOW_COOKIE,
  flowCookieHeader,
  lineIdentity,
  memberForLine,
  type OAuthFlow,
  readCookie,
  readFlow,
} from "@/server/lib/mobile/oauth";

/**
 * LINE sign-in, step 2 (LINE returns here): verify, find or create the
 * member, and hand the app a one-time code bound to its PKCE challenge.
 * Linking LINE to a signed-in member (src/server/lib/mobile/line-link.ts)
 * returns here too: then link it and send the outcome back.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const flow = readFlow(
    readCookie(request, FLOW_COOKIE),
    url.searchParams.get("state"),
  );
  const back = (to: string, query: Record<string, string>) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `${to}?${new URLSearchParams(query).toString()}`,
        // The sign-in is used up either way.
        "Set-Cookie": flowCookieHeader("", url.protocol === "https:"),
        "Cache-Control": "no-store",
      },
    });
  // Without our cookie this isn't a sign-in the app started: never mint a
  // code for it.
  if (!flow) return back(APP_REDIRECT, { error: "signin_failed" });
  if (flow.link) return link(flow.link, flow, url);
  const code = url.searchParams.get("code");
  if (!code) return back(flow.redirect, { error: "cancelled" });
  try {
    const identity = await lineIdentity(code, flow, url.origin);
    if (!identity) return back(flow.redirect, { error: "signin_failed" });
    const userId = await memberForLine(identity, flow.locale);
    return back(flow.redirect, {
      code: createHandoffCode(userId, flow.challenge),
    });
  } catch (e) {
    console.error("[oauth] LINE sign-in failed", e);
    return back(flow.redirect, { error: "signin_failed" });
  }
}

/** The end of linking LINE: ?line=<outcome> to where the app asked. */
async function link(
  memberId: string,
  flow: OAuthFlow,
  url: URL,
): Promise<Response> {
  const done = (outcome: LineLinkOutcome) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: withOutcome(flow.redirect, outcome),
        "Set-Cookie": flowCookieHeader("", url.protocol === "https:"),
        "Cache-Control": "no-store",
      },
    });
  // The member declined (error=access_denied) or LINE reported an error.
  if (url.searchParams.get("error")) return done("cancelled");
  const code = url.searchParams.get("code");
  if (!code) return done("error");
  try {
    const identity = await lineIdentity(code, flow, url.origin);
    if (!identity) return done("error");
    return done(await linkLine(memberId, identity));
  } catch (e) {
    console.error("[line-link] failed", e);
    return done("error");
  }
}
