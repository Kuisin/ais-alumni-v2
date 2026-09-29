import { Redirect, Stack } from "expo-router";
import { hasStaffAccess } from "@/features/admin/nav";
import { useMe } from "@/lib/auth";
import { stackScreenOptions } from "@/lib/navigation";

export const unstable_settings = { anchor: "index" };

/**
 * 管理モード (the website's /app/admin): committee admins and members holding
 * a position. Each screen's API checks its own permission, as each website
 * page does; members with no admin-mode access go back home.
 */
export default function AdminLayout() {
  const me = useMe();
  if (!hasStaffAccess(me.access)) return <Redirect href="/home" />;
  return <Stack screenOptions={stackScreenOptions} />;
}
