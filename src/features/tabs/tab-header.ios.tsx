import {
  type NativeStackHeaderItem,
  type NativeStackNavigationOptions,
  useRouter,
} from "expo-router";
import { useTranslations } from "use-intl";
import { ProfileButton } from "@/features/me/profile-button";
import { useMe } from "@/lib/auth";
import { colors } from "@/ui";

/**
 * Every tab's header on iOS: マイページ's button (the member's photo, round,
 * with the number of follow requests waiting) at the top left, and
 * お知らせ's bell (unread count) as a native item at the right — which on
 * the iPhone Duo iOS puts in its vertical bar above the tab bar.
 *
 * The photo stays a React view on purpose: as a native left item, iOS moved
 * it between the header and the vertical bar as the screen updated; React
 * views always stay in the header. Android and the web: tab-header.tsx.
 */
export function useTabHeaderOptions(): NativeStackNavigationOptions {
  const ti = useTranslations("mobile.inbox");
  const router = useRouter();
  const me = useMe();
  const unread = me.badges.inbox;

  const bell: NativeStackHeaderItem = {
    type: "button",
    label: ti("bell"),
    accessibilityLabel:
      unread > 0 ? ti("bellUnread", { count: unread }) : ti("bell"),
    icon: { type: "sfSymbol", name: "bell" },
    tintColor: colors.slate700,
    badge: unread > 0 ? { value: unread } : undefined,
    identifier: "tab-inbox",
    onPress: () => router.push("/notifications"),
  };
  return {
    headerLeft: () => <ProfileButton />,
    unstable_headerRightItems: () => [bell],
  };
}
