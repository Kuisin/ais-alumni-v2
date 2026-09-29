import type { AdminNewsRow } from "@contract/admin-news";
import type { Locale } from "@contract/core";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, Newspaper, Plus } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { AudienceBadges } from "@/features/admin/events/parts";
import { useAdminNewsList } from "@/features/admin/news/api";
import { StatusBadges } from "@/features/admin/news/parts";
import { ReadMeter, readPercent } from "@/features/admin/notify/receipts";
import { FallbackTag, Notice } from "@/features/news/parts";
import { Chips } from "@/features/people/choices";
import { formatDateTime } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import {
  Badge,
  Button,
  colors,
  EmptyState,
  ErrorState,
  Loading,
  space,
  Text,
} from "@/ui";

/**
 * ニュース管理 (the website's /app/admin/news): every post for admins, the
 * author's own for others (同窓会委員 also see the posts they may approve),
 * drafts first; archived posts on their own tab.
 */
export default function AdminNewsScreen() {
  const t = useTranslations("adminContent.news");
  const tm = useTranslations("mobile.errors");
  const router = useRouter();
  const { deleted } = useLocalSearchParams<{ deleted?: string }>();
  const [archived, setArchived] = useState(false);
  const list = useAdminNewsList(archived);
  const [refreshing, setRefreshing] = useState(false);
  // The editor (/app/news/new), when the app has it.
  const create = hrefFor("/app/news/new");

  const first = list.data?.pages[0];
  const posts: AdminNewsRow[] = [];
  const ids = new Set<string>();
  for (const page of list.data?.pages ?? [])
    for (const p of page.posts)
      if (!ids.has(p.id)) {
        ids.add(p.id);
        posts.push(p);
      }

  const refresh = async () => {
    setRefreshing(true);
    await list.refetch().catch(() => {});
    setRefreshing(false);
  };

  const newButton = (variant: "primary" | "secondary") =>
    create ? (
      <Button
        variant={variant}
        compact
        label={t("new")}
        icon={(c) => <Plus size={16} color={c} aria-hidden />}
        onPress={() => router.push(create)}
        style={styles.start}
      />
    ) : null;

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      {list.data === undefined ? (
        list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <Loading />
        )
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <PostRow
              post={item}
              first={index === 0}
              last={index === posts.length - 1}
              onPress={() => router.push(`/admin/news/${item.id}`)}
            />
          )}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text variant="small" tone="muted">
                {first?.isAdmin ? t("description") : t("descriptionOwn")}
              </Text>
              {newButton("primary")}
              <Chips
                label={t("archiveTabs")}
                choices={[
                  { value: "active", label: t("tabActive") },
                  {
                    value: "archived",
                    label: `${t("tabArchived")} (${first?.archivedCount ?? 0})`,
                  },
                ]}
                value={archived ? "archived" : "active"}
                onChange={(v) => setArchived(v === "archived")}
              />
              {deleted === "1" ? (
                <Notice tone="success">{t("deleted")}</Notice>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Newspaper size={32} color={colors.slate400} aria-hidden />}
              title={t("empty")}
              hint={t("emptyHint")}
              action={newButton("secondary")}
            />
          }
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage)
              void list.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.brand700}
              colors={[colors.brand700]}
            />
          }
        />
      )}
    </>
  );
}

function PostRow({
  post: p,
  first,
  last,
  onPress,
}: {
  post: AdminNewsRow;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const t = useTranslations("adminContent");
  const locale = useLocale() as Locale;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={p.title || "—"}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        first ? styles.rowFirst : null,
        last ? styles.rowLast : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.rowBody}>
        <View style={styles.badges}>
          <StatusBadges post={p} />
          {p.noNotify ? <Badge label={t("news.noNotify")} /> : null}
          {p.publishedAt ? (
            <Text variant="small" tone="muted">
              {p.status === "scheduled"
                ? t("news.scheduledFor", {
                    date: formatDateTime(p.publishedAt, locale),
                  })
                : formatDateTime(p.publishedAt, locale)}
            </Text>
          ) : null}
        </View>
        <Text weight="semibold">
          {p.title || "—"}
          <FallbackTag fallback={p.titleFallback} />
        </Text>
        <View style={styles.badges}>
          <AudienceBadges audience={p.audience} />
        </View>
        {p.reads ? (
          <View style={styles.meter}>
            <ReadMeter
              read={p.reads.read}
              total={p.reads.audience}
              label={t("news.readOf", p.reads)}
              percentLabel={t("reads.percent", {
                percent: readPercent(p.reads.read, p.reads.audience),
              })}
            />
          </View>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.slate400} aria-hidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.md, marginBottom: space.lg },
  start: { alignSelf: "flex-start" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
    borderColor: colors.border,
  },
  rowFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  rowLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  pressed: { backgroundColor: colors.slate50 },
  rowBody: { flex: 1, gap: space.xs },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.xs,
  },
  meter: { maxWidth: 240, paddingTop: space.xs },
  footer: { gap: space.md, paddingVertical: space.lg },
});
