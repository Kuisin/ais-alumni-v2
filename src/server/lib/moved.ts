/**
 * The old website's pages (/ja/…, /en/…, /app/… — Kuisin/ais-alumni-app,
 * whose domain this app took over): 「サイトが移転しました」
 * (src/app/moved.tsx) with the old path, which links to the same screen
 * here when there is one. Not permanent, so bookmarks keep asking.
 */
export function movedRedirect(request: Request): Response {
  const url = new URL(request.url);
  const to = new URL("/moved", url.origin);
  to.searchParams.set("from", url.pathname + url.search);
  return new Response(null, {
    status: 307,
    headers: { Location: to.toString(), "Cache-Control": "no-store" },
  });
}
