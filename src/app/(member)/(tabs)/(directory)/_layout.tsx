import { useTranslations } from "use-intl";
import { TabStack } from "@/features/tabs/tab-stack";

export default function DirectoryLayout() {
  const t = useTranslations("common.nav");
  return <TabStack name="directory" title={t("directory")} />;
}
