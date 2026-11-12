import { useTranslations } from "use-intl";
import { TabStack } from "@/features/tabs/tab-stack";

export default function HomeLayout() {
  const t = useTranslations("common.nav");
  return <TabStack name="home" title={t("dashboard")} />;
}
