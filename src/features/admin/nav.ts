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
import { ADMIN_PAGES } from "./paths";

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
 * (src/components/layout/app-shell.tsx). The website page → screen pairs
 * are in paths.ts (the server maps links with them too).
 */
export const ADMIN_NAV: AdminNavItem[] = [
  // 審査
  {
    group: "review",
    label: "adminNav.verification",
    icon: BadgeCheck,
    ...ADMIN_PAGES.verification,
    allowed: admin,
    count: "verification",
  },
  {
    group: "review",
    label: "adminNav.recordRequests",
    icon: FilePen,
    ...ADMIN_PAGES.recordRequests,
    allowed: admin,
    count: "recordRequests",
  },
  {
    group: "review",
    label: "adminNav.nameRequests",
    icon: IdCard,
    ...ADMIN_PAGES.nameRequests,
    allowed: admin,
    count: "nameRequests",
  },
  {
    group: "review",
    label: "adminNav.support",
    icon: LifeBuoy,
    ...ADMIN_PAGES.support,
    allowed: admin,
    count: "support",
  },
  {
    group: "review",
    label: "adminNav.chat",
    icon: MessagesSquare,
    ...ADMIN_PAGES.chat,
    allowed: admin,
    count: "chat",
  },
  // 会員
  {
    group: "people",
    label: "adminNav.members",
    icon: Users,
    ...ADMIN_PAGES.members,
    allowed: admin,
  },
  {
    group: "people",
    label: "adminNav.teachers",
    icon: UserCheck,
    ...ADMIN_PAGES.teachers,
    allowed: (a) => a.teachers,
  },
  {
    group: "people",
    label: "adminNav.cohorts",
    icon: Layers,
    ...ADMIN_PAGES.cohorts,
    allowed: admin,
  },
  // 発信
  {
    group: "outreach",
    label: "nav.notify",
    icon: Megaphone,
    ...ADMIN_PAGES.notify,
    allowed: (a) => a.broadcast,
  },
  {
    group: "outreach",
    label: "adminNav.events",
    icon: CalendarDays,
    ...ADMIN_PAGES.events,
    allowed: (a) => a.news,
  },
  {
    group: "outreach",
    label: "adminNav.news",
    icon: Newspaper,
    ...ADMIN_PAGES.news,
    allowed: (a) => a.news,
  },
  {
    group: "outreach",
    label: "adminNav.line",
    icon: MessageCircle,
    ...ADMIN_PAGES.line,
    allowed: admin,
  },
  // データ
  {
    group: "data",
    label: "adminNav.destinations",
    icon: Route,
    ...ADMIN_PAGES.destinations,
    allowed: admin,
  },
  {
    group: "data",
    label: "adminNav.stats",
    icon: ChartColumn,
    ...ADMIN_PAGES.stats,
    allowed: admin,
  },
  {
    group: "data",
    label: "adminNav.organizations",
    icon: Building2,
    ...ADMIN_PAGES.organizations,
    allowed: admin,
  },
  {
    group: "data",
    label: "adminNav.roster",
    icon: TableProperties,
    ...ADMIN_PAGES.roster,
    allowed: admin,
  },
  {
    group: "data",
    label: "adminNav.audit",
    icon: ScrollText,
    ...ADMIN_PAGES.audit,
    allowed: admin,
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
