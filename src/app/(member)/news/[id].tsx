import type { NewsDetail } from "@contract/news";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useNewsDetail, useReadReceipt } from "@/features/news/api";
import { NewsArticle } from "@/features/news/article";
import { QueryState } from "@/ui";

/** Signed file URLs last 15 minutes; renew them a little before. */
const URL_FRESH_MS = 10 * 60_000;

/**
 * One ニュース post (the website's /app/news/[id]). Opening it records the
 * read, as on the website (not for an admin outside the audience).
 */
export default function NewsPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations("news");
  const query = useNewsDetail(id);
  const [refreshing, setRefreshing] = useState(false);
  useReadReceipt(query.data);

  const title = query.data ? query.data.title || t("untitled") : t("title");

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  const fresh = async (): Promise<NewsDetail> => {
    const current = query.data as NewsDetail;
    if (Date.now() - query.dataUpdatedAt < URL_FRESH_MS) return current;
    const next = await query.refetch().catch(() => null);
    return next?.data ?? current;
  };

  return (
    <>
      <Stack.Screen options={{ title }} />
      <QueryState query={query}>
        {(post) => (
          <NewsArticle
            post={post}
            refreshing={refreshing}
            onRefresh={refresh}
            fresh={fresh}
          />
        )}
      </QueryState>
    </>
  );
}
