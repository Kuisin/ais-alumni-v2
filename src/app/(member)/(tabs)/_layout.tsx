import { Tabs } from "expo-router";
import {
  CalendarDays,
  House,
  MessagesSquare,
  Newspaper,
  Users,
} from "lucide-react-native";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { ProfileButton } from "@/features/me/profile-button";
import { InboxBell } from "@/features/notifications/inbox-bell";
import { useMe } from "@/lib/auth";
import { colors, font } from "@/ui/theme";

const badge = (n: number) => (n > 0 ? (n > 99 ? "99+" : n) : undefined);

/**
 * The web's tab bar, without the bottom inset: taller than the default
 * 49, which is sized for the native bars and cuts the labels off under the
 * icons in a browser.
 */
const WEB_TAB_BAR = 68;
const WEB_TAB_BAR_PADDING = 6;

/**
 * The bottom tab bar: the website's places, with マイページ as the photo at
 * the top left of every tab (it carries the follow-request count).
 */
export default function TabLayout() {
  const t = useTranslations("common.nav");
  const { badges } = useMe();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.slate500,
        tabBarLabelStyle: { fontSize: 11, fontWeight: font.weight.medium },
        tabBarBadgeStyle: { backgroundColor: colors.red600, fontSize: 10 },
        ...(Platform.OS === "web"
          ? {
              tabBarStyle: {
                height: WEB_TAB_BAR + insets.bottom,
                paddingTop: WEB_TAB_BAR_PADDING,
                paddingBottom: WEB_TAB_BAR_PADDING + insets.bottom,
              },
            }
          : null),
        headerTitleStyle: {
          color: colors.text,
          fontWeight: font.weight.semibold,
        },
        headerStyle: { backgroundColor: colors.surface },
        sceneStyle: { backgroundColor: colors.background },
        headerLeft: () => <ProfileButton />,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("dashboard"),
          headerRight: () => <InboxBell />,
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          title: t("directory"),
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t("events"),
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: t("news"),
          tabBarBadge: badge(badges.news + badges.messages),
          tabBarIcon: ({ color, size }) => (
            <Newspaper color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t("chat"),
          tabBarBadge: badge(badges.chat),
          tabBarIcon: ({ color, size }) => (
            <MessagesSquare color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
