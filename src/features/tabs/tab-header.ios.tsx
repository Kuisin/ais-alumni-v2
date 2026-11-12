import {
  type NativeStackHeaderItem,
  type NativeStackNavigationOptions,
  useRouter,
} from "expo-router";
import { useTranslations } from "use-intl";
import { useMe } from "@/lib/auth";
import { absoluteUrl } from "@/lib/config";
import { colors } from "@/ui";

/**
 * Every tab's header on iOS: マイページ (the member's photo, with the number of
 * follow requests waiting) at the left and お知らせ's bell (unread count) at
 * the right, as native bar items — so on the iPhone Duo iOS moves them into
 * its vertical bar above the tab bar, which it doesn't do with React views.
 * Android and the web: tab-header.tsx.
 */
export function useTabHeaderOptions(): NativeStackNavigationOptions {
  const t = useTranslations("common.nav");
  const tf = useTranslations("dashboard.todo");
  const ti = useTranslations("mobile.inbox");
  const router = useRouter();
  const me = useMe();
  const waiting = me.badges.follows;
  const unread = me.badges.inbox;
  const photo = me.user.avatar;

  const profile: NativeStackHeaderItem = {
    type: "button",
    label: t("profileShort"),
    accessibilityLabel:
      waiting > 0
        ? `${t("profileShort")}, ${tf("followRequests", { count: waiting })}`
        : t("profileShort"),
    // A bar item's image can't be SVG (the default icon without a gender).
    icon:
      photo && !/\.svg(\?|$)/i.test(photo)
        ? {
            type: "image",
            source: { uri: absoluteUrl(photo), width: 30, height: 30 },
            tinted: false,
          }
        : { type: "sfSymbol", name: "person.crop.circle" },
    badge: waiting > 0 ? { value: waiting } : undefined,
    identifier: "tab-profile",
    onPress: () => router.push("/me"),
  };
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
    unstable_headerLeftItems: () => [profile],
    unstable_headerRightItems: () => [bell],
  };
}
