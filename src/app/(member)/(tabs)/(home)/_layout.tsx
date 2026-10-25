import { useTranslations } from "use-intl";
import { InboxBell } from "@/features/notifications/inbox-bell";
import { TabStack } from "@/features/tabs/tab-stack";

export default function HomeLayout() {
  const t = useTranslations("common.nav");
  return (
    <TabStack
      name="home"
      title={t("dashboard")}
      headerRight={() => <InboxBell />}
    />
  );
}
