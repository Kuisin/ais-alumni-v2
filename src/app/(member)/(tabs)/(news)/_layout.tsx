import { useTranslations } from "use-intl";
import { TabStack } from "@/features/tabs/tab-stack";

export default function NewsLayout() {
  const t = useTranslations("common.nav");
  return <TabStack name="news" title={t("news")} />;
}
