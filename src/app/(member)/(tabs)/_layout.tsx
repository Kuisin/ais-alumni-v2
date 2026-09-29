import { Tabs } from "expo-router";
import {
  CalendarDays,
  House,
  MessagesSquare,
  Newspaper,
  Users,
} from "lucide-react-native";
import { useTranslations } from "use-intl";
import { ProfileButton } from "@/features/me/profile-button";
import { InboxBell } from "@/features/notifications/inbox-bell";
import { useMe } from "@/lib/auth";
import { colors, font } from "@/ui/theme";

const badge = (n: number) => (n > 0 ? (n > 99 ? "99+" : n) : undefined);

/**
 * The bottom tab bar: the website's places, with マイページ as the photo at
 * the top left of every tab (it carries the follow-request count).
 */
export default function TabLayout() {
  const t = useTranslations("common.nav");
  const { badges } = useMe();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.slate500,
        tabBarLabelStyle: { fontSize: 11, fontWeight: font.weight.medium },
        tabBarBadgeStyle: { backgroundColor: colors.red600, fontSize: 10 },
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
