import type { Href } from "expo-router";

/**
 * 管理モード's pages: the website's page → the native screen. Plain data
 * (no icons, no React Native), so the server can map notification links
 * too (src/lib/site-paths.ts). The sidebar entries: nav.ts.
 */
export const ADMIN_PAGES = {
  verification: {
    webPath: "/app/admin/verification",
    href: "/admin/verification",
  },
  recordRequests: {
    webPath: "/app/admin/record-requests",
    href: "/admin/record-requests",
  },
  nameRequests: {
    webPath: "/app/admin/name-requests",
    href: "/admin/name-requests",
  },
  support: { webPath: "/app/admin/support", href: "/admin/support" },
  chat: { webPath: "/app/admin/chat", href: "/admin/chat" },
  members: { webPath: "/app/admin/members", href: "/admin/members" },
  teachers: { webPath: "/app/admin/teachers", href: "/admin/teachers" },
  cohorts: { webPath: "/app/admin/cohorts", href: "/admin/cohorts" },
  notify: { webPath: "/app/admin/notify", href: "/admin/notify" },
  events: { webPath: "/app/admin/events", href: "/admin/events" },
  news: { webPath: "/app/admin/news", href: "/admin/news" },
  line: { webPath: "/app/admin/line", href: "/admin/line" },
  destinations: {
    webPath: "/app/admin/destinations",
    href: "/admin/destinations",
  },
  stats: { webPath: "/app/admin/stats", href: "/admin/stats" },
  organizations: {
    webPath: "/app/admin/organizations",
    href: "/admin/organizations",
  },
  roster: { webPath: "/app/admin/roster", href: "/admin/roster" },
  audit: { webPath: "/app/admin/audit", href: "/admin/audit" },
} as const satisfies Record<string, { webPath: string; href: Href }>;

/** Admin detail pages with a native screen: website path → app route. */
export const ADMIN_DETAIL: { re: RegExp; to: (id: string) => Href }[] = [
  {
    re: /^\/app\/admin\/members\/([A-Za-z0-9_-]{1,64})$/,
    to: (id) => ({ pathname: "/admin/members/[id]", params: { id } }),
  },
  // One application (notifications about new applications link here).
  {
    re: /^\/app\/admin\/verification\/([A-Za-z0-9_-]{1,64})$/,
    to: (id) => ({ pathname: "/admin/verification/[id]", params: { id } }),
  },
];

/** The native screen for a website admin page ("/app/admin/members"). */
export function adminHrefFor(path: string): Href | null {
  if (path === "/app/admin") return "/admin";
  for (const d of ADMIN_DETAIL) {
    const id = d.re.exec(path)?.[1];
    if (id) return d.to(id);
  }
  return (
    Object.values(ADMIN_PAGES).find((p) => p.webPath === path)?.href ?? null
  );
}
