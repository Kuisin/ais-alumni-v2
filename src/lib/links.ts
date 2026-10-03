import type { Href } from "expo-router";
import { API_URL, SITE_URL } from "./config";
import { nativeHref, splitSitePath } from "./site-paths";

export { nativeHref } from "./site-paths";

/**
 * Website URLs → app screens: links in news posts and notifications open
 * the matching native screen (the path rules: src/lib/site-paths.ts); links
 * the app has no screen for aren't offered.
 */

export type SiteUrl = { path: string; query: URLSearchParams };

/**
 * A URL or path on the website, without its locale:
 * "https://ais.kai-lab.net/ja/app/follows?tab=x" → { path: "/app/follows",
 * query: tab=x }. Null for other sites (or anything unparsable). Without an
 * `origin`, both the old website's and this app's own domain count.
 */
export function siteUrl(urlOrPath: string, origin?: string): SiteUrl | null {
  let rest = urlOrPath;
  if (/^[a-z][a-z0-9+.-]*:/i.test(urlOrPath)) {
    try {
      const u = new URL(urlOrPath);
      const origins = (origin ? [origin] : [SITE_URL, API_URL]).map(
        (o) => new URL(o).origin,
      );
      if (!origins.includes(u.origin)) return null;
      rest = u.pathname + u.search;
    } catch {
      return null;
    }
  }
  return splitSitePath(rest);
}

/** Just the path of siteUrl() (null for other sites). */
export function sitePath(urlOrPath: string, origin?: string): string | null {
  return siteUrl(urlOrPath, origin)?.path ?? null;
}

/**
 * The native screen for a website path or URL ("/app/follows?tab=requests",
 * "https://ais.kai-lab.net/ja/app/news/…"), or null when the app has no such
 * screen — callers then leave the entry out. The app never opens the
 * website.
 */
export function hrefFor(urlOrPath: string): Href | null {
  const site = siteUrl(urlOrPath);
  return site ? nativeHref(site.path, site.query) : null;
}
