import type { NativeStackNavigationOptions } from "expo-router";
import { ProfileButton } from "@/features/me/profile-button";
import { InboxBell } from "@/features/notifications/inbox-bell";

/**
 * Every tab's header: マイページ's photo at the left, お知らせ's bell at the
 * right. Android and the web draw them as React views; iOS uses native bar
 * items (tab-header.ios.tsx).
 */
export function useTabHeaderOptions(): NativeStackNavigationOptions {
  return {
    headerLeft: () => <ProfileButton />,
    headerRight: () => <InboxBell />,
  };
}
