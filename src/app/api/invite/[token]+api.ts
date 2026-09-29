/**
 * Invitation links in the website's form (/api/invite/<token>?l=ja) opened
 * on this app's domain: continue at the app's /invite/<token>, which keeps
 * the token and goes to sign-in.
 */
export function GET(request: Request, { token }: { token: string }) {
  const url = new URL(request.url);
  const to = new URL(`/invite/${encodeURIComponent(token)}`, url.origin);
  return Response.redirect(to, 303);
}
