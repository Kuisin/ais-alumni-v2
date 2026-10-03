import type { Href } from "expo-router";
import { adminHrefFor } from "@/features/admin/paths";

/**
 * Website paths → app screens, without React Native (the server uses it
 * too: notification short links, src/server/lib/notify/open.ts). Links in
 * news posts, notification paths and paths from the API ("/app/…") open
 * the matching native screen; paths the app has no screen for aren't
 * offered. URLs: src/lib/links.ts.
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
  {
    re: /^\/app\/admin\/events\/ID$/,
    to: (m) => `/admin/events/${m[1]}`,
    keep: ["created"],
  },
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
  { re: /^\/app\/news$/, to: () => "/news", keep: ["tab"] },
  { re: /^\/app\/news\/new$/, to: () => "/news/new" },
  { re: /^\/app\/news\/messages\/ID$/, to: (m) => `/news/messages/${m[1]}` },
  {
    re: /^\/app\/news\/(?!new$|messages$)ID$/,
    to: (m) => `/news/${m[1]}`,
  },
  { re: /^\/app\/chat$/, to: () => "/chat" },
  { re: /^\/app\/chat\/new$/, to: () => "/chat/new" },
  { re: /^\/app\/chat\/(?!new$)ID$/, to: (m) => `/chat/${m[1]}` },
  { re: /^\/app\/chat\/ID\/info$/, to: (m) => `/chat/${m[1]}/info` },
  { re: /^\/app\/profile(\/edit)?$/, to: () => "/profile" },
  { re: /^\/app\/profile\/history$/, to: () => "/profile/history" },
  { re: /^\/app\/profile\/record$/, to: () => "/profile/record" },
  { re: /^\/app\/follows$/, to: () => "/follows", keep: ["tab"] },
  { re: /^\/app\/settings$/, to: () => "/settings" },
  { re: /^\/app\/family$/, to: () => "/family" },
  { re: /^\/app\/invite$/, to: () => "/invite" },
  { re: /^\/app\/vouch\/ID$/, to: (m) => `/vouch/${m[1]}` },
  // Registration: /onboarding opens the step the account is on.
  {
    re: /^\/app\/onboarding(\/(email|line|verify|status))?$/,
    to: () => "/onboarding",
  },
  { re: /^\/app\/handover\/ID$/, to: (m) => `/handover/${m[1]}` },
  { re: /^\/privacy$/, to: () => "/privacy" },
  { re: /^\/donate$/, to: () => "/donate" },
  { re: /^\/install$/, to: () => "/install" },
  { re: /^\/terms$/, to: () => "/terms" },
  { re: /^\/support$/, to: () => "/support", keep: ["type", "topic"] },
  // 管理モード pages below a section (sections: src/features/admin/nav.ts)
  { re: /^\/app\/admin\/notify\/ID$/, to: (m) => `/admin/notify/${m[1]}` },
  {
    re: /^\/app\/admin\/news\/ID$/,
    to: (m) => `/admin/news/${m[1]}`,
    keep: ["created", "notify", "notified", "approved"],
  },
];

const RULES: Rule[] = PATTERNS.map((r) => ({
  ...r,
  re: new RegExp(r.re.source.replaceAll("ID", ID)),
}));

/** The native screen for a website path, or null if the app has none. */
export function nativeHref(
  path: string,
  query: URLSearchParams = new URLSearchParams(),
): Href | null {
  // 管理モード: the sections built so far (src/features/admin/nav.ts); their
  // sub-pages (e.g. one event) are RULES below.
  if (path === "/app/admin" || path.startsWith("/app/admin/")) {
    const section = adminHrefFor(path);
    if (section) return section;
  }
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
 * A website path without its locale, and its query: "/ja/app/news?tab=x" →
 * { path: "/app/news", query: tab=x }.
 */
export function splitSitePath(rest: string): {
  path: string;
  query: URLSearchParams;
} {
  const [pathPart = "", queryPart = ""] = rest.split("#")[0]?.split("?") ?? [];
  const path =
    pathPart.replace(/^\/(ja|en)(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  return { path, query: new URLSearchParams(queryPart) };
}

/** An href as a URL path: "/admin/members/[id]" with its params filled in. */
export function hrefPath(href: Href): string {
  if (typeof href === "string") return href;
  const { pathname, params = {} } = href as {
    pathname: string;
    params?: Record<string, string | string[] | undefined>;
  };
  const used = new Set<string>();
  const path = pathname.replace(
    /\[(?:\.\.\.)?([^\]]+)\]/g,
    (_, key: string) => {
      used.add(key);
      const v = params[key] ?? "";
      return (Array.isArray(v) ? v : [v]).map(encodeURIComponent).join("/");
    },
  );
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (!used.has(k) && v !== undefined)
      for (const one of Array.isArray(v) ? v : [v]) query.append(k, one);
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * A website path as this app's web path, for links sent by LINE or email:
 * "/ja/app/news/x" → "/news/x", "/app/settings#line" → "/settings#line".
 * Paths without a screen here → "/".
 */
export function webPathFor(sitePath: string): string {
  const hash = sitePath.includes("#")
    ? sitePath.slice(sitePath.indexOf("#"))
    : "";
  const { path, query } = splitSitePath(sitePath);
  if (path === "/privacy" || path === "/support") return path + hash;
  const href = nativeHref(path, query);
  return (href ? hrefPath(href) : "/") + hash;
}
