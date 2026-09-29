import type { Href } from "expo-router";
import { adminHrefFor } from "@/features/admin/nav";
import { SITE_URL } from "./config";

/**
 * Website paths → app screens: links in news posts, notification paths and
 * paths from the API ("/app/…") open the matching native screen; paths the
 * app has no screen for aren't offered.
 *
 * Keep RULES in step with the routes under src/app/(member). A rule may
 * carry query parameters the native screen understands (`keep`).
 */

type Rule = {
  re: RegExp;
  to: (m: RegExpExecArray) => string;
  /** query parameters passed on to the native screen */
  keep?: readonly string[];
};

const ID = "([A-Za-z0-9_-]{1,64})";

const PATTERNS: Rule[] = [
  { re: /^\/app\/dashboard$/, to: () => "/home" },
  { re: /^\/app\/directory$/, to: () => "/directory" },
  { re: /^\/app\/members\/ID$/, to: (m) => `/members/${m[1]}`, keep: ["as"] },
  { re: /^\/app\/events$/, to: () => "/events" },
  { re: /^\/app\/events\/new$/, to: () => "/events/new" },
  { re: /^\/app\/events\/(?!new$)ID$/, to: (m) => `/events/${m[1]}` },
  {
    re: /^\/app\/events\/(?!new$)ID\/check-in$/,
    to: (m) => `/events/${m[1]}/check-in`,
    keep: ["t"],
  },
  { re: /^\/app\/news$/, to: () => "/news" },
  { re: /^\/app\/news\/new$/, to: () => "/news/new" },
  {
    re: /^\/app\/news\/(?!new$|messages$)ID$/,
    to: (m) => `/news/${m[1]}`,
  },
  { re: /^\/app\/chat$/, to: () => "/chat" },
  { re: /^\/app\/chat\/new$/, to: () => "/chat/new" },
  { re: /^\/app\/chat\/(?!new$)ID$/, to: (m) => `/chat/${m[1]}` },
  { re: /^\/app\/chat\/ID\/info$/, to: (m) => `/chat/${m[1]}/info` },
  { re: /^\/app\/profile(\/edit)?$/, to: () => "/me" },
  { re: /^\/app\/profile\/history$/, to: () => "/profile/history" },
  { re: /^\/app\/profile\/record$/, to: () => "/profile/record" },
  { re: /^\/app\/follows$/, to: () => "/follows", keep: ["tab"] },
  { re: /^\/app\/settings$/, to: () => "/settings" },
  { re: /^\/app\/family$/, to: () => "/family" },
  { re: /^\/app\/invite$/, to: () => "/invite" },
  { re: /^\/app\/vouch\/ID$/, to: (m) => `/vouch/${m[1]}` },
];

const RULES: Rule[] = PATTERNS.map((r) => ({
  ...r,
  re: new RegExp(r.re.source.replaceAll("ID", ID)),
}));

export type SiteUrl = { path: string; query: URLSearchParams };

/**
 * A URL or path on the website, without its locale:
 * "https://ais.kai-lab.net/ja/app/follows?tab=x" → { path: "/app/follows",
 * query: tab=x }. Null for other sites (or anything unparsable).
 */
export function siteUrl(urlOrPath: string, origin = SITE_URL): SiteUrl | null {
  let rest = urlOrPath;
  if (/^[a-z][a-z0-9+.-]*:/i.test(urlOrPath)) {
    try {
      const u = new URL(urlOrPath);
      if (u.origin !== new URL(origin).origin) return null;
      rest = u.pathname + u.search;
    } catch {
      return null;
    }
  }
  const [pathPart = "", queryPart = ""] = rest.split("#")[0]?.split("?") ?? [];
  const path =
    pathPart.replace(/^\/(ja|en)(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  return { path, query: new URLSearchParams(queryPart) };
}

/** Just the path of siteUrl() (null for other sites). */
export function sitePath(urlOrPath: string, origin = SITE_URL): string | null {
  return siteUrl(urlOrPath, origin)?.path ?? null;
}

/** The native screen for a website path, or null if the app has none. */
export function nativeHref(
  path: string,
  query: URLSearchParams = new URLSearchParams(),
): Href | null {
  // 管理モード: the sections built so far (src/features/admin/nav.ts).
  if (path === "/app/admin" || path.startsWith("/app/admin/"))
    return adminHrefFor(path);
  for (const rule of RULES) {
    const m = rule.re.exec(path);
    if (!m) continue;
    const pathname = rule.to(m);
    const params: Record<string, string> = {};
    for (const key of rule.keep ?? []) {
      const v = query.get(key);
      if (v) params[key] = v;
    }
    return (
      Object.keys(params).length ? { pathname, params } : pathname
    ) as Href;
  }
  return null;
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
