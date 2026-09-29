import type { AdminCounts } from "@contract/admin";
import type { StaffAccess } from "@contract/core";
import type { Href } from "expo-router";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ChartColumn,
  FilePen,
  IdCard,
  Layers,
  LifeBuoy,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  Route,
  ScrollText,
  TableProperties,
  UserCheck,
  Users,
} from "lucide-react-native";

/** The website's admin sidebar groups (common.adminGroups.<group>). */
export type AdminGroup = "review" | "people" | "outreach" | "data";

export const ADMIN_GROUPS: readonly AdminGroup[] = [
  "review",
  "people",
  "outreach",
  "data",
];

export type AdminNavItem = {
  group: AdminGroup;
  /** key in the "common" namespace */
  label: string;
  icon: LucideIcon;
  /** the website's page (links in notifications open the screen) */
  webPath: string;
  /** who sees it: the same checks as the website's page */
  allowed: (a: StaffAccess) => boolean;
  /** the native screen; null = not built yet (the entry is left out) */
  href: Href | null;
  /** badge: work waiting (GET /admin) */
  count?: keyof AdminCounts;
};

const admin = (a: StaffAccess) => a.admin;

/**
 * 管理モード's sections, in the website's sidebar order
 * (src/components/layout/app-shell.tsx). Each screen sets `href` when it is
 * built; entries with none are hidden.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  // 審査
  {
    group: "review",
    label: "adminNav.verification",
    icon: BadgeCheck,
    webPath: "/app/admin/verification",
    allowed: admin,
    href: "/admin/verification",
    count: "verification",
  },
  {
    group: "review",
    label: "adminNav.recordRequests",
    icon: FilePen,
    webPath: "/app/admin/record-requests",
    allowed: admin,
    href: null,
    count: "recordRequests",
  },
  {
    group: "review",
    label: "adminNav.nameRequests",
    icon: IdCard,
    webPath: "/app/admin/name-requests",
    allowed: admin,
    href: null,
    count: "nameRequests",
  },
  {
    group: "review",
    label: "adminNav.support",
    icon: LifeBuoy,
    webPath: "/app/admin/support",
    allowed: admin,
    href: null,
    count: "support",
  },
  {
    group: "review",
    label: "adminNav.chat",
    icon: MessagesSquare,
    webPath: "/app/admin/chat",
    allowed: admin,
    href: null,
    count: "chat",
  },
  // 会員
  {
    group: "people",
    label: "adminNav.members",
    icon: Users,
    webPath: "/app/admin/members",
    allowed: admin,
    href: null,
  },
  {
    group: "people",
    label: "adminNav.teachers",
    icon: UserCheck,
    webPath: "/app/admin/teachers",
    allowed: (a) => a.teachers,
    href: null,
  },
  {
    group: "people",
    label: "adminNav.cohorts",
    icon: Layers,
    webPath: "/app/admin/cohorts",
    allowed: admin,
    href: null,
  },
  // 発信
  {
    group: "outreach",
    label: "nav.notify",
    icon: Megaphone,
    webPath: "/app/admin/notify",
    allowed: (a) => a.broadcast,
    href: null,
  },
  {
    group: "outreach",
    label: "adminNav.events",
    icon: CalendarDays,
    webPath: "/app/admin/events",
    allowed: (a) => a.news,
    href: null,
  },
  {
    group: "outreach",
    label: "adminNav.news",
    icon: Newspaper,
    webPath: "/app/admin/news",
    allowed: (a) => a.news,
    href: null,
  },
  {
    group: "outreach",
    label: "adminNav.line",
    icon: MessageCircle,
    webPath: "/app/admin/line",
    allowed: admin,
    href: null,
  },
  // データ
  {
    group: "data",
    label: "adminNav.destinations",
    icon: Route,
    webPath: "/app/admin/destinations",
    allowed: admin,
    href: null,
  },
  {
    group: "data",
    label: "adminNav.stats",
    icon: ChartColumn,
    webPath: "/app/admin/stats",
    allowed: admin,
    href: null,
  },
  {
    group: "data",
    label: "adminNav.organizations",
    icon: Building2,
    webPath: "/app/admin/organizations",
    allowed: admin,
    href: null,
  },
  {
    group: "data",
    label: "adminNav.roster",
    icon: TableProperties,
    webPath: "/app/admin/roster",
    allowed: admin,
    href: "/admin/roster",
  },
  {
    group: "data",
    label: "adminNav.audit",
    icon: ScrollText,
    webPath: "/app/admin/audit",
    allowed: admin,
    href: null,
  },
];

/** Whether the member sees 管理モード at all (permissions.hasStaffAccess). */
export function hasStaffAccess(a: StaffAccess): boolean {
  return a.admin || a.broadcast || a.teachers || a.news;
}

/** The built sections this member may open, by group. */
export function adminSections(
  a: StaffAccess,
): { group: AdminGroup; items: AdminNavItem[] }[] {
  return ADMIN_GROUPS.map((group) => ({
    group,
    items: ADMIN_NAV.filter(
      (i) => i.group === group && i.href !== null && i.allowed(a),
    ),
  })).filter((g) => g.items.length > 0);
}

/** The native screen for a website admin page ("/app/admin/members"). */
export function adminHrefFor(path: string): Href | null {
  if (path === "/app/admin") return "/admin";
  // One application (notifications about new applications link here).
  const verification =
    /^\/app\/admin\/verification\/([A-Za-z0-9_-]{1,64})$/.exec(path);
  if (verification?.[1])
    return {
      pathname: "/admin/verification/[id]",
      params: { id: verification[1] },
    };
  return ADMIN_NAV.find((i) => i.webPath === path)?.href ?? null;
}
