import { useTranslations } from "use-intl";
import { TabStack } from "@/features/tabs/tab-stack";

export default function EventsLayout() {
  const t = useTranslations("common.nav");
  return <TabStack name="events" title={t("events")} />;
}
