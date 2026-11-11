import { NativeTabs } from "expo-router/native-tabs";
import { useTranslations } from "use-intl";
import { useMe } from "@/lib/auth";
import { colors } from "@/ui/theme";

const badge = (n: number) => (n > 0 ? (n > 99 ? "99+" : String(n)) : null);

/**
 * iOS: the system's tab bar (Android and the web: _layout.tsx), with iOS's
 * defaults — on the iPhone Duo the icon bar in its vertical bar, folded or
 * open. react-native-screens ≥ 4.30.1 sizes the tab bar controller before
 * attaching it; before that, started on the Duo's open display the tabs
 * were missing until it was folded and opened
 * (software-mansion/react-native-screens#4989). Each tab's own stack draws
 * its header (features/tabs/tab-stack).
 */
export default function TabLayout() {
  const t = useTranslations("common.nav");
  const { badges } = useMe();
  const news = badge(badges.news + badges.messages);
  const chat = badge(badges.chat);
  return (
    <NativeTabs
      tintColor={colors.brand700}
      badgeBackgroundColor={colors.red600}
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
        />
        <NativeTabs.Trigger.Label>{t("dashboard")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(directory)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
        />
        <NativeTabs.Trigger.Label>{t("directory")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(events)">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>{t("events")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(news)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "newspaper", selected: "newspaper.fill" }}
        />
        <NativeTabs.Trigger.Label>{t("news")}</NativeTabs.Trigger.Label>
        {news ? (
          <NativeTabs.Trigger.Badge>{news}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(chat)">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "bubble.left.and.bubble.right",
            selected: "bubble.left.and.bubble.right.fill",
          }}
        />
        <NativeTabs.Trigger.Label>{t("chat")}</NativeTabs.Trigger.Label>
        {chat ? (
          <NativeTabs.Trigger.Badge>{chat}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
