import type { InboxItem } from "@contract/notifications";
import { Stack, useRouter } from "expo-router";
import { Bell, CheckCheck } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useTranslations } from "use-intl";
import { listTime } from "@/features/chat/time";
import {
  useInbox,
  useMarkAllRead,
  useMarkSeen,
  useOpenInboxItem,
} from "@/features/notifications/api";
import { useAuth } from "@/lib/auth";
import { hrefFor } from "@/lib/links";
import {
  Button,
  colors,
  EmptyState,
  ErrorState,
  Loading,
  radius,
  space,
  Text,
} from "@/ui";

/**
 * お知らせ (app only): every notification sent to the member with
 * something to open — news, events, requests, account notices — whichever
 * way it went (app, LINE, email); chats are in the chat tab. New entries
 * are highlighted; seeing them here lowers the bell's count, and opening
 * one counts as reading it (like tapping the notification).
 */
export default function NotificationsScreen() {
  const t = useTranslations("mobile.inbox");
  const tm = useTranslations("mobile.errors");
  const router = useRouter();
  const list = useInbox();
  const seen = useMarkSeen();
  const markAll = useMarkAllRead();
  const open = useOpenInboxItem();
  const [refreshing, setRefreshing] = useState(false);

  const items: InboxItem[] = [];
  const ids = new Set<string>();
  for (const page of list.data?.pages ?? [])
    for (const i of page.items)
      if (!ids.has(i.id)) {
        ids.add(i.id);
        items.push(i);
      }
  const anyUnread = items.some((i) => !i.read);

  // What's on screen counts as seen (the highlight stays for this visit).
  const reported = useRef(new Set<string>());
  const seenMutate = seen.mutate;
  useEffect(() => {
    const fresh = items
      .filter((i) => !i.read && !reported.current.has(i.id))
      .map((i) => i.id);
    if (fresh.length === 0) return;
    for (const id of fresh) reported.current.add(id);
    seenMutate(fresh.slice(0, 200));
  });

  const refresh = async () => {
    setRefreshing(true);
    await list.refetch().catch(() => {});
    setRefreshing(false);
  };

  const onOpen = (item: InboxItem) => {
    open.mutate(item.id);
    if (item.path) router.push(hrefFor(item.path, item.title));
  };

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
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <InboxRow item={item} onPress={() => onOpen(item)} />
          )}
          ItemSeparatorComponent={Gap}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text variant="small" tone="muted">
                {t("description")}
              </Text>
              {anyUnread ? (
                <Button
                  variant="secondary"
                  compact
                  label={t("markAll")}
                  icon={(c) => <CheckCheck size={18} color={c} aria-hidden />}
                  loading={markAll.isPending}
                  onPress={() => markAll.mutate()}
                  style={styles.markAll}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Bell size={32} color={colors.slate400} aria-hidden />}
              title={t("empty")}
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
            if (
              list.hasNextPage &&
              !list.isFetching &&
              !list.isFetchNextPageError
            )
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
      )}
    </>
  );
}

function InboxRow({ item, onPress }: { item: InboxItem; onPress: () => void }) {
  const t = useTranslations("mobile.inbox");
  const tc = useTranslations("chat.room");
  const tr = useTranslations("notifications.receipts.channel");
  const { locale } = useAuth();
  const when = listTime(item.sentAt, locale, tc("yesterday"));
  const via = item.channels
    .filter((c) => c === "PUSH" || c === "LINE" || c === "EMAIL")
    .map((c) => tr(c))
    .join(" · ");
  const unread = !item.read;
  return (
    <Pressable
      accessibilityRole={item.path ? "link" : "text"}
      accessibilityLabel={[
        unread ? t("unread") : null,
        item.title,
        item.body,
        when,
      ]
        .filter(Boolean)
        .join(", ")}
      disabled={!item.path && item.read}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        unread ? styles.unread : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.emoji}>
        <Text style={styles.emojiText} aria-hidden>
          {item.emoji}
        </Text>
      </View>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text
            weight={unread ? "semibold" : "medium"}
            numberOfLines={2}
            style={styles.flex}
          >
            {item.title}
          </Text>
          {unread ? <View style={styles.dot} /> : null}
        </View>
        {item.body ? (
          <Text variant="small" tone="muted" numberOfLines={3}>
            {item.body}
          </Text>
        ) : null}
        <Text variant="caption" tone="subtle">
          {via ? `${when} · ${via}` : when}
        </Text>
      </View>
    </Pressable>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.md, marginBottom: space.lg },
  markAll: { alignSelf: "flex-start" },
  gap: { height: space.sm },
  footer: { gap: space.md, paddingVertical: space.lg },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unread: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  pressed: { opacity: 0.7 },
  emoji: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.slate100,
  },
  emojiText: { fontSize: 20, lineHeight: 26 },
  text: { flex: 1, gap: 2 },
  titleLine: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 7,
    backgroundColor: colors.brand700,
  },
});
