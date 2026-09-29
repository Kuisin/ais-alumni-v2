import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { useAfterCreate } from "@/features/compose/after-save";
import { useComposeOptions } from "@/features/compose/api";
import { EMPTY_NEWS, NewsForm } from "@/features/compose/news-form";
import { QueryState, Screen, Text } from "@/ui";

/**
 * 「ニュースを作成」 (the website's /app/news/new): admins, current teachers,
 * 同窓会委員 and 学年代表 (their own 学年). Members see the role it is sent
 * as, not the author's name.
 */
export default function NewNewsScreen() {
  const t = useTranslations("news");
  const ts = useTranslations("news.sender");
  const options = useComposeOptions();
  const afterCreate = useAfterCreate("news");
  return (
    <>
      <Stack.Screen options={{ title: t("create") }} />
      <QueryState query={options}>
        {(o) => (
          <Screen>
            <Text tone="muted">{ts("postingAs", { role: o.role })}</Text>
            <NewsForm values={EMPTY_NEWS} options={o} onSaved={afterCreate} />
          </Screen>
        )}
      </QueryState>
    </>
  );
}
