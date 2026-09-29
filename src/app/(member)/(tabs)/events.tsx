import type { EventTab } from "@contract/events";
import { useRouter } from "expo-router";
import { CalendarDays } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useEventList } from "@/features/events/api";
import { EventCard } from "@/features/events/event-card";
import { SegmentedTabs } from "@/features/events/parts";
import {
  Button,
  colors,
  EmptyState,
  ErrorState,
  Loading,
  ScreenView,
  space,
  Text,
  TOUCH,
} from "@/ui";

/**
 * イベント (the website's /app/events): upcoming (incl. in progress) or past
 * events for this member, 20 at a time, with their own answer. Authors
 * create events on the website screen.
 */
export default function EventsTab() {
  const t = useTranslations("events");
  const tm = useTranslations("mobile.errors");
  const router = useRouter();
  const [tab, setTab] = useState<EventTab>("upcoming");
  const [refreshing, setRefreshing] = useState(false);
  const list = useEventList(tab);
  const events = list.data?.pages.flatMap((p) => p.events) ?? [];

  const refresh = async () => {
    setRefreshing(true);
    await list.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <ScreenView>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onPress={() =>
              router.push({ pathname: "/events/[id]", params: { id: item.id } })
            }
          />
        )}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="small" tone="muted">
              {t("description")}
            </Text>
            <SegmentedTabs
              label={t("tabs.label")}
              value={tab}
              onChange={setTab}
              items={[
                { key: "upcoming", label: t("tabs.upcoming") },
                { key: "past", label: t("tabs.past") },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          list.isPending ? (
            <Loading inline />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : (
            <EmptyState
              icon={<CalendarDays size={32} color={colors.slate400} />}
              title={tab === "past" ? t("emptyPast") : t("emptyUpcoming")}
            />
          )
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
                compact
                label={tm("retry")}
                onPress={() => list.fetchNextPage()}
              />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetching) void list.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
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
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.md, marginBottom: space.lg },
  gap: { height: space.md },
  footer: { alignItems: "center", gap: space.sm, paddingVertical: space.lg },
  create: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: TOUCH,
    paddingHorizontal: space.lg,
  },
  pressed: { opacity: 0.6 },
});
