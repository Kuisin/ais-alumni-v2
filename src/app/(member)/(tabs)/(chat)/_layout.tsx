import { useTranslations } from "use-intl";
import { TabStack } from "@/features/tabs/tab-stack";

export default function ChatLayout() {
  const t = useTranslations("common.nav");
  return <TabStack name="chat" title={t("chat")} />;
}
