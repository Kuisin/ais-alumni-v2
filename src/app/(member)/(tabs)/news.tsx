import type { MessageSummary, NewsSummary } from "@contract/news";
import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import { Mail, Newspaper } from "lucide-react-native";
import { type ReactElement, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { SegmentedTabs } from "@/features/events/parts";
import { useMessageList, useNewsList } from "@/features/news/api";
import { MessageRow } from "@/features/news/message-row";
import { NewsCard } from "@/features/news/news-card";
import { useMe } from "@/lib/auth";
import {
  Button,
  colors,
  EmptyState,
  ErrorState,
  HeaderButton,
  Loading,
  space,
  Text,
} from "@/ui";

type Tab = "news" | "messages";

/**
 * ニュース (the website's /app/news): pinned posts first, 10 per page,
 * loaded as the member scrolls. News authors get 「ニュースを作成」 in the
 * header (/news/new), like イベント's 「イベントを作成」. While messages are switched on (me.features.messages), a
 * second tab lists あなた宛ての連絡 (?tab=messages).
 */
export default function NewsScreen() {
  const me = useMe();
  const params = useLocalSearchParams<{ tab?: string }>();
  const messagesOn = me.features.messages;
  const wanted: Tab =
    messagesOn && params.tab === "messages" ? "messages" : "news";
  const [tab, setTab] = useState<Tab>(wanted);
  // Opened again from a link (Home's banner, a notification).
  useEffect(() => setTab(wanted), [wanted]);
  const t = useTranslations("news");
  const router = useRouter();
  const canCreate = useNewsList().data?.pages[0]?.canCreate ?? false;
  const header = (
    <Tabs.Screen
      options={{
        headerRight: canCreate
          ? () => (
              <HeaderButton
                label={t("create")}
                onPress={() => router.push("/news/new")}
              />
            )
          : undefined,
      }}
    />
  );
  const tabs = messagesOn ? (
    <SegmentedTabs
      label={t("tabs.label")}
      value={tab}
      onChange={setTab}
      items={[
        { key: "news", label: withCount(t("tabs.news"), me.badges.news) },
        {
          key: "messages",
          label: withCount(t("tabs.messages"), me.badges.messages),
        },
      ]}
    />
  ) : null;
  return (
    <>
      {header}
      {tab === "messages" ? (
        <MessagesTab tabs={tabs} />
      ) : (
        <NewsTab tabs={tabs} />
      )}
    </>
  );
}

const withCount = (label: string, n: number) => (n ? `${label} ${n}` : label);

function NewsTab({ tabs }: { tabs: ReactElement | null }) {
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
        <NewsCard post={item} onPress={() => router.push(`/news/${item.id}`)} />
      )}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <View style={styles.header}>
          {tabs}
          <Text variant="small" tone="muted">
            {t("description")}
          </Text>
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

/** あなた宛ての連絡 (20 per page, newest first). */
function MessagesTab({ tabs }: { tabs: ReactElement | null }) {
  const t = useTranslations("news");
  const tm = useTranslations("mobile.errors");
  const router = useRouter();
  const list = useMessageList(true);
  const [refreshing, setRefreshing] = useState(false);
  const seen = new Set<string>();
  const rows: MessageSummary[] = [];
  for (const page of list.data?.pages ?? [])
    for (const m of page.messages)
      if (!seen.has(m.id)) {
        seen.add(m.id);
        rows.push(m);
      }

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
      data={rows}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => (
        <MessageRow
          message={item}
          onPress={() => router.push(`/news/messages/${item.id}`)}
        />
      )}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={<View style={styles.header}>{tabs}</View>}
      ListEmptyComponent={
        <EmptyState
          icon={<Mail size={32} color={colors.slate400} aria-hidden />}
          title={t("messages.empty")}
          hint={t("messages.emptyHint")}
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
