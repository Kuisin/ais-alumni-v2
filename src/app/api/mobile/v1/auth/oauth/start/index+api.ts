import {
  allowedRedirect,
  flowCookieHeader,
  lineAuthorizeUrl,
  lineReady,
  newFlow,
  validChallenge,
} from "@/server/lib/mobile/oauth";

/**
 * LINE sign-in, step 1 (opened by the app in a browser): remember the
 * sign-in and go to LINE. See src/server/lib/mobile/oauth.ts.
 */
export function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams;
  const redirect = allowedRedirect(q.get("redirect"), url.origin);
  if (!redirect || !validChallenge(q.get("challenge")))
    return Response.json({ error: "invalid" }, { status: 400 });
  if (q.get("provider") !== "line" || !lineReady())
    return Response.json({ error: "unavailable" }, { status: 404 });
  const locale = q.get("locale") === "en" ? "en" : "ja";
  const { flow, cookie } = newFlow(
    q.get("challenge") as string,
    redirect,
    locale,
  );
  return new Response(null, {
    status: 302,
    headers: {
      Location: lineAuthorizeUrl(flow, url.origin),
      "Set-Cookie": flowCookieHeader(cookie, url.protocol === "https:"),
      "Cache-Control": "no-store",
    },
  });
}
