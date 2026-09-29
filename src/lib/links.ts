import type { Href } from "expo-router";
import { SITE_URL } from "./config";

/**
 * Website paths ↔ app screens. Pages the app has natively open natively —
 * from links in news posts, from the web view, from notifications — and
 * everything else opens in the web view (src/app/web.tsx), signed in.
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
  { re: /^\/app\/events\/(?!new$)ID$/, to: (m) => `/events/${m[1]}` },
  { re: /^\/app\/news$/, to: () => "/news" },
  {
    re: /^\/app\/news\/(?!new$|messages$)ID$/,
    to: (m) => `/news/${m[1]}`,
  },
  { re: /^\/app\/chat$/, to: () => "/chat" },
  { re: /^\/app\/chat\/new$/, to: () => "/chat/new" },
  { re: /^\/app\/chat\/(?!new$)ID$/, to: (m) => `/chat/${m[1]}` },
  { re: /^\/app\/chat\/ID\/info$/, to: (m) => `/chat/${m[1]}/info` },
  { re: /^\/app\/profile$/, to: () => "/me" },
  { re: /^\/app\/follows$/, to: () => "/follows", keep: ["tab"] },
  { re: /^\/app\/settings$/, to: () => "/settings" },
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

/** Open a website page in the app's web view (signed in). */
export function webHref(path: string, title?: string): Href {
  return {
    pathname: "/web",
    params: title ? { path, title } : { path },
  } as Href;
}

/**
 * Native screen if there is one, else the web view. Takes a site path
 * ("/app/follows?tab=requests") or an absolute URL on the website.
 */
export function hrefFor(urlOrPath: string, title?: string): Href {
  const site = siteUrl(urlOrPath);
  if (!site) return webHref(urlOrPath, title);
  const search = site.query.toString();
  return (
    nativeHref(site.path, site.query) ??
    webHref(search ? `${site.path}?${search}` : site.path, title)
  );
}
