import type { NewsSummary } from "@contract/news";
import { useRouter } from "expo-router";
import { Newspaper, Plus } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useNewsList } from "@/features/news/api";
import { NewsCard } from "@/features/news/news-card";
import { hrefFor, webHref } from "@/lib/links";
import {
  Button,
  colors,
  EmptyState,
  ErrorState,
  Loading,
  space,
  Text,
} from "@/ui";

/**
 * ニュース (the website's /app/news): pinned posts first, 10 per page,
 * loaded as the member scrolls. News authors get 「ニュースを作成」, which
 * opens the website's editor.
 */
export default function NewsScreen() {
  const t = useTranslations("news");
  const tm = useTranslations("mobile.errors");
  const router = useRouter();
  const list = useNewsList();
  const [refreshing, setRefreshing] = useState(false);

  // Pages can shift while scrolling (a new post): show each post once.
  const seen = new Set<string>();
  const posts: NewsSummary[] = [];
  for (const page of list.data?.pages ?? [])
    for (const p of page.posts)
      if (!seen.has(p.id)) {
        seen.add(p.id);
        posts.push(p);
      }
  const canCreate = list.data?.pages[0]?.canCreate ?? false;

  const refresh = async () => {
    setRefreshing(true);
    await list.refetch().catch(() => {});
    setRefreshing(false);
  };

  if (list.data === undefined)
    return list.isError ? (
      <ErrorState error={list.error} onRetry={() => list.refetch()} />
    ) : (
      <Loading />
    );

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <NewsCard
          post={item}
          onPress={() => router.push(hrefFor(`/app/news/${item.id}`))}
        />
      )}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text variant="small" tone="muted">
            {t("description")}
          </Text>
          {canCreate ? (
            <Button
              variant="secondary"
              label={t("create")}
              icon={(c) => <Plus size={18} color={c} aria-hidden />}
              onPress={() => router.push(webHref("/app/news/new", t("create")))}
            />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon={<Newspaper size={32} color={colors.slate400} aria-hidden />}
          title={t("empty")}
          hint={t("emptyHint")}
        />
      }
      ListFooterComponent={
        list.isFetchingNextPage ? (
          <Loading inline />
        ) : list.isFetchNextPageError ? (
          <View style={styles.footer}>
            <Text variant="small" tone="muted" center>
              {tm("generic")}
            </Text>
            <Button
              variant="secondary"
              label={tm("retry")}
              onPress={() => void list.fetchNextPage()}
            />
          </View>
        ) : null
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        // After a failed page, the footer's retry button takes over.
        if (list.hasNextPage && !list.isFetching && !list.isFetchNextPageError)
          void list.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.brand700}
          colors={[colors.brand700]}
        />
      }
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.md, marginBottom: space.lg },
  gap: { height: space.md },
  footer: { gap: space.md, paddingVertical: space.lg },
});
