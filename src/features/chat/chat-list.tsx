import type { ChatList, ChatListRow } from "@contract/chat";
import type { Locale } from "@contract/core";
import { Tabs, useFocusEffect, useRouter } from "expo-router";
import { MessageCirclePlus, Search, Users } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { useRealtimeLive } from "@/lib/realtime";
import {
  Avatar,
  colors,
  EmptyState,
  HeaderButton,
  QueryState,
  ScreenView,
  space,
  Text,
  TOUCH,
} from "@/ui";
import { useChatList } from "./api";
import { listTime } from "./time";

type Filter = "all" | "direct" | "groups";

const POLL_MS = 20_000;

/**
 * チャット (the website's /app/chat): talks and group chats, newest
 * activity first — search, filter chips, unread counts, 「あなた宛」 for
 * mentions; admins also see the groups they're not in.
 */
export function ChatListScreen() {
  const t = useTranslations("chat");
  const router = useRouter();
  const live = useRealtimeLive();
  const list = useChatList();
  const { refetch } = list;
  // Fresh whenever the tab is shown; without Realtime, also every 20 s
  // while it's on screen.
  const shownBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (shownBefore.current) void refetch({ cancelRefetch: false });
      shownBefore.current = true;
      if (live) return;
      const timer = setInterval(() => void refetch(), POLL_MS);
      return () => clearInterval(timer);
    }, [live, refetch]),
  );

  return (
    <ScreenView>
      <Tabs.Screen
        options={{
          headerRight: list.data?.canStartDirect
            ? () => (
                <HeaderButton
                  label={t("newTalk")}
                  icon={MessageCirclePlus}
                  onPress={() => router.push("/chat/new")}
                />
              )
            : undefined,
        }}
      />
      <QueryState query={list}>
        {(data) => <ChatListBody data={data} refetch={refetch} />}
      </QueryState>
    </ScreenView>
  );
}

function ChatListBody({
  data,
  refetch,
}: {
  data: ChatList;
  refetch: () => Promise<unknown>;
}) {
  const t = useTranslations("chat");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const term = q.trim().toLowerCase();
  const shown = data.rows.filter(
    (r) =>
      (filter === "all" || (filter === "direct" ? r.direct : !r.direct)) &&
      (!term ||
        r.name.toLowerCase().includes(term) ||
        r.preview.toLowerCase().includes(term)),
  );
  const joined = shown.filter((r) => r.joined);
  const others = shown.filter((r) => !r.joined);
  const sections = [
    ...(joined.length ? [{ key: "joined", title: null, data: joined }] : []),
    ...(others.length
      ? [{ key: "others", title: t("allGroups"), data: others }]
      : []),
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <SectionList
      sections={sections}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <ChatRowItem row={item} />}
      renderSectionHeader={({ section }) =>
        section.title ? (
          <View style={styles.sectionHeader}>
            <Text
              variant="caption"
              weight="semibold"
              tone="muted"
              accessibilityRole="header"
            >
              {section.title}
            </Text>
          </View>
        ) : null
      }
      stickySectionHeadersEnabled={false}
      ItemSeparatorComponent={RowSeparator}
      ListHeaderComponent={
        <View style={styles.toolbar}>
          <View style={styles.search}>
            <Search size={16} color={colors.slate400} aria-hidden />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t("search")}
              placeholderTextColor={colors.slate500}
              accessibilityLabel={t("search")}
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={styles.searchInput}
            />
          </View>
          <View
            style={styles.chips}
            accessibilityRole="radiogroup"
            accessibilityLabel={t("filter")}
          >
            {(["all", "direct", "groups"] as const).map((f) => {
              const on = filter === f;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setFilter(f)}
                  style={[styles.chip, on ? styles.chipOn : null]}
                >
                  <Text
                    variant="small"
                    weight={on ? "semibold" : "regular"}
                    style={{ color: on ? colors.brand800 : colors.slate700 }}
                  >
                    {t(`filters.${f}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <EmptyState
            title={term ? t("noMatch") : t("empty")}
            hint={term ? undefined : t("emptyHint")}
          />
        </View>
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand700}
          colors={[colors.brand700]}
        />
      }
    />
  );
}

function RowSeparator() {
  return <View style={styles.separator} />;
}

function ChatRowItem({ row: r }: { row: ChatListRow }) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const when = r.lastAt
    ? listTime(r.lastAt, locale, t("room.yesterday"))
    : null;
  const label = [
    r.direct ? r.name : `${r.name} (${r.memberCount})`,
    r.mentioned ? t("mentionedYou") : null,
    r.preview,
    when,
    r.unread ? t("unread", { count: r.unread }) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() =>
        router.push({ pathname: "/chat/[id]", params: { id: r.id } })
      }
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      {r.direct ? (
        <Avatar uri={r.avatar} size={52} />
      ) : (
        <View style={styles.groupIcon}>
          <Users size={24} color={colors.brand800} />
        </View>
      )}
      <View style={styles.rowText}>
        <View style={styles.line}>
          <Text weight="semibold" numberOfLines={1} style={styles.name}>
            {r.name}
            {!r.direct ? (
              <Text tone="subtle" weight="regular">
                {` (${r.memberCount})`}
              </Text>
            ) : null}
          </Text>
          {when ? (
            <Text variant="caption" tone="subtle" style={styles.nums}>
              {when}
            </Text>
          ) : null}
        </View>
        <View style={styles.line}>
          <Text
            variant="small"
            tone="subtle"
            numberOfLines={1}
            style={styles.preview}
          >
            {r.mentioned ? (
              <Text variant="small" weight="semibold" style={styles.mention}>
                {`${t("mentionedYou")} `}
              </Text>
            ) : null}
            {r.preview}
          </Text>
          {r.unread ? (
            <View style={styles.unread}>
              <Text variant="caption" weight="semibold" tone="inverse">
                {r.unread > 999 ? "999+" : String(r.unread)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: space.xl },
  toolbar: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  search: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.md,
    borderRadius: 999,
    backgroundColor: colors.slate100,
  },
  searchInput: {
    flex: 1,
    minHeight: TOUCH,
    paddingRight: space.lg,
    fontSize: 16,
    color: colors.text,
  },
  chips: { flexDirection: "row", gap: space.sm },
  chip: {
    minHeight: TOUCH,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.brand700, backgroundColor: colors.brand50 },
  sectionHeader: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.slate50,
  },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.slate50 },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand100,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  name: { flex: 1, color: colors.slate900 },
  nums: { fontVariant: ["tabular-nums"] },
  preview: { flex: 1 },
  mention: { color: colors.red600 },
  unread: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.red600,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: space.lg + 52 + space.md,
    backgroundColor: colors.slate100,
  },
  empty: { padding: space.lg },
});
