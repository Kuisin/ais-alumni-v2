import type { MessageSummary, NewsSummary } from "@contract/news";
import { useRouter } from "expo-router";
import { Mail, Newspaper } from "lucide-react-native";
import { type ReactElement, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  Button,
  colors,
  EmptyState,
  Loading,
  ScreenView,
  space,
  Text,
} from "@/ui";
import { MessageRow } from "./message-row";
import { NewsCard } from "./news-card";

/** What a feed needs of its infinite query (useNewsList / useMessageList). */
export type FeedPager = {
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
};

export type FeedProps<T> = {
  items: T[];
  /** above the rows, scrolling with them (「ニュースを作成」, the tabs …) */
  header: ReactElement | null;
  pager: FeedPager;
};

/**
 * ニュース's posts (the website's /app/news), loaded page by page as the
 * member scrolls. iOS: feed.ios.tsx (the system's list).
 */
export function NewsFeed({ items, header, pager }: FeedProps<NewsSummary>) {
  const t = useTranslations("news");
  const router = useRouter();
  return (
    <Feed
      items={items}
      header={header}
      pager={pager}
      render={(post) => (
        <NewsCard post={post} onPress={() => router.push(`/news/${post.id}`)} />
      )}
      empty={
        <EmptyState
          icon={<Newspaper size={32} color={colors.slate400} aria-hidden />}
          title={t("empty")}
          hint={t("emptyHint")}
        />
      }
    />
  );
}

/** あなた宛ての連絡 (20 per page, newest first). */
export function MessageFeed({
  items,
  header,
  pager,
}: FeedProps<MessageSummary>) {
  const t = useTranslations("news");
  const router = useRouter();
  return (
    <Feed
      items={items}
      header={header}
      pager={pager}
      render={(message) => (
        <MessageRow
          message={message}
          onPress={() => router.push(`/news/messages/${message.id}`)}
        />
      )}
      empty={
        <EmptyState
          icon={<Mail size={32} color={colors.slate400} aria-hidden />}
          title={t("messages.empty")}
          hint={t("messages.emptyHint")}
        />
      }
    />
  );
}

function Feed<T extends { id: string }>({
  items,
  header,
  pager,
  render,
  empty,
}: FeedProps<T> & {
  render: (item: T) => ReactElement;
  empty: ReactElement;
}) {
  const tm = useTranslations("mobile.errors");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await pager.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <ScreenView>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => render(item)}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          header ? <View style={styles.header}>{header}</View> : undefined
        }
        ListEmptyComponent={empty}
        ListFooterComponent={
          pager.isFetchingNextPage ? (
            <Loading inline />
          ) : pager.isFetchNextPageError ? (
            <View style={styles.footer}>
              <Text variant="small" tone="muted" center>
                {tm("generic")}
              </Text>
              <Button
                variant="secondary"
                label={tm("retry")}
                onPress={() => void pager.fetchNextPage()}
              />
            </View>
          ) : undefined
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          // After a failed page, the footer's retry button takes over.
          if (
            pager.hasNextPage &&
            !pager.isFetching &&
            !pager.isFetchNextPageError
          )
            void pager.fetchNextPage();
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
    </ScreenView>
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
