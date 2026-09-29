import type { ChatMessage, ChatRoom } from "@contract/chat";
import type { Locale } from "@contract/core";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  Stack,
  useIsFocused,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import {
  ChevronRight,
  Copy,
  Info,
  Radio,
  RefreshCw,
  Trash2,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale, useTranslations } from "use-intl";
import { useMe } from "@/lib/auth";
import { useRealtimeLive } from "@/lib/realtime";
import { colors, QueryState, space, Text, TOUCH } from "@/ui";
import { useChatRoom } from "../api";
import { confirmDestructive, showError } from "../dialogs";
import { MemberTags } from "../member-tags";
import { ALL_LABELS } from "../mentions";
import { dayLabel, jstDay, timeOfDay } from "../time";
import { Composer } from "./composer";
import { type RoomItem, RoomRow } from "./message-row";
import { MessageSheet } from "./message-sheet";
import { useRoom } from "./use-room";

/** Count of `sorted` (ascending ISO) at or after `at`. */
function countFrom(sorted: readonly string[], at: string): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < at) lo = mid + 1;
    else hi = mid;
  }
  return sorted.length - lo;
}

/**
 * A talk (the website's /app/chat/[id]): bubbles (own on the right), date
 * pills, the unread line, 既読 marks, @mentions, long press to copy or
 * delete, and the composer — or why the member can't post. The header
 * opens the talk's details.
 */
export function ChatRoomScreen() {
  const t = useTranslations("chat");
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useChatRoom(id);
  const room = query.data;
  const title = room
    ? room.direct
      ? room.title
      : `${room.title} (${room.memberCount})`
    : t("title");
  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerBackButtonDisplayMode: "minimal",
          headerTitle: room ? () => <RoomTitle room={room} /> : undefined,
          headerRight: room
            ? () => <RoomHeaderRight id={room.id} />
            : undefined,
        }}
      />
      <View style={styles.screen}>
        <QueryState query={query}>
          {(data) => (
            <Room key={data.id} room={data} fresh={query.isFetchedAfterMount} />
          )}
        </QueryState>
      </View>
    </>
  );
}

function useOpenInfo(id: string) {
  const router = useRouter();
  return () => router.push({ pathname: "/chat/[id]/info", params: { id } });
}

/** Name (N) › — tap for the talk's details, as on the website. */
function RoomTitle({ room }: { room: ChatRoom }) {
  const t = useTranslations("chat.room");
  const openInfo = useOpenInfo(room.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${room.title} — ${t("infoOpen")}`}
      onPress={openInfo}
      style={styles.title}
    >
      <View style={styles.titleLine}>
        <Text weight="bold" numberOfLines={1} style={styles.titleText}>
          {room.title}
          {!room.direct ? (
            <Text weight="regular">{` (${room.memberCount})`}</Text>
          ) : null}
        </Text>
        <ChevronRight size={16} color={colors.slate400} />
      </View>
      {room.direct && room.partner ? (
        <MemberTags cohort={room.partner.cohort} rep={room.partner.rep} />
      ) : null}
    </Pressable>
  );
}

function RoomHeaderRight({ id }: { id: string }) {
  const t = useTranslations("chat.room");
  const live = useRealtimeLive();
  const openInfo = useOpenInfo(id);
  return (
    <View style={styles.headerRight}>
      <View
        accessible
        accessibilityLabel={live ? t("live") : t("polling")}
        style={styles.liveIcon}
      >
        {live ? (
          <Radio size={16} color={colors.green600} />
        ) : (
          <RefreshCw size={16} color={colors.slate500} />
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("infoOpen")}
        onPress={openInfo}
        hitSlop={4}
        style={({ pressed }) => [
          styles.iconButton,
          pressed ? styles.iconPressed : null,
        ]}
      >
        <Info size={22} color={colors.brand700} />
      </Pressable>
    </View>
  );
}

function Room({ room, fresh }: { room: ChatRoom; fresh: boolean }) {
  const t = useTranslations("chat.room");
  const tc = useTranslations("chat");
  const tCommon = useTranslations("common");
  const tm = useTranslations("mobile");
  const locale = useLocale() as Locale;
  const me = useMe().user.id;
  const focused = useIsFocused();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const state = useRoom({ room, meId: me, focused, fresh });
  const { messages, reads, divider } = state;
  const list = useRef<FlatList<RoomItem>>(null);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const keyboard = useKeyboardShown();

  const canPost = room.member && !room.stopped;
  const others = room.members.filter((m) => m.id !== me);
  const namesById = new Map(room.members.map((m) => [m.id, m.name]));
  const allLabels = [t("mentionAll"), ...ALL_LABELS];
  const sortedReads = [...reads].sort();
  const words = { today: t("today"), yesterday: t("yesterday") };

  // Oldest first, then reversed for the inverted list (newest at the bottom).
  const items: RoomItem[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const day = jstDay(m.createdAt);
    const newDay = !prev || jstDay(prev.createdAt) !== day;
    if (newDay)
      items.push({
        kind: "day",
        key: `day:${day}`,
        label: dayLabel(m.createdAt, locale, words),
      });
    if (m.id === divider)
      items.push({
        kind: "divider",
        key: "divider",
        label: t("unreadDivider"),
      });
    const mine = m.userId === me;
    const n = mine ? countFrom(sortedReads, m.createdAt) : 0;
    items.push({
      kind: "message",
      key: m.id,
      m,
      mine,
      runStart: newDay || !prev || prev.userId !== m.userId || m.id === divider,
      readLabel:
        mine && n > 0
          ? room.direct
            ? t("read")
            : t("readCount", { count: n })
          : null,
      time: timeOfDay(m.createdAt, locale),
      mentionLabels: [
        ...m.mentionUserIds.map((uid) => namesById.get(uid) ?? ""),
        ...(m.mentionAll ? allLabels : []),
      ],
    });
  });
  items.reverse();

  // Open at the unread line (once), when it's further up than the screen.
  const scrolledToDivider = useRef(false);
  const dividerIndex = items.findIndex((it) => it.kind === "divider");
  useEffect(() => {
    if (scrolledToDivider.current || dividerIndex < 0) return;
    scrolledToDivider.current = true;
    const timer = setTimeout(() => {
      list.current?.scrollToIndex({
        index: dividerIndex,
        viewPosition: 1,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [dividerIndex]);

  const onLongPress = (m: ChatMessage) => {
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => {},
      );
    setSelected(m);
  };

  const remove = async (m: ChatMessage) => {
    setSelected(null);
    const ok = await confirmDestructive(t("deleteConfirm"), {
      confirm: t("delete"),
      cancel: tCommon("cancel"),
    });
    if (!ok) return;
    try {
      await state.remove(m.id);
    } catch {
      showError(tm("errors.generic"));
    }
  };

  const canDelete = (m: ChatMessage) =>
    !m.deleted && (m.userId === me || room.moderator);
  const bottom = keyboard ? space.sm : Math.max(insets.bottom, space.sm);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyCard}>
            <Text variant="small" tone="muted" center>
              {tc("noMessages")}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          ref={list}
          inverted
          data={items}
          keyExtractor={(it) => it.key}
          renderItem={({ item }) => (
            <RoomRow
              item={item}
              direct={room.direct}
              deletedLabel={t("deleted")}
              actionsHint={tm("chat.actionsHint")}
              onLongPress={onLongPress}
            />
          )}
          onEndReached={() => void state.loadOlder()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            state.loadingOlder ? (
              <View style={styles.older}>
                <ActivityIndicator color={colors.brand700} />
              </View>
            ) : (
              <View style={styles.listEnd} />
            )
          }
          onScrollToIndexFailed={(info) => {
            list.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: false,
            });
            setTimeout(
              () =>
                list.current?.scrollToIndex({
                  index: info.index,
                  viewPosition: 1,
                  animated: false,
                }),
              120,
            );
          }}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 80,
          }}
          initialNumToRender={24}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          contentContainerStyle={styles.listContent}
          style={styles.flex}
        />
      )}

      {canPost ? (
        <Composer
          others={others}
          direct={room.direct}
          bottomInset={bottom}
          onSend={async (body) => {
            await state.send(body);
            list.current?.scrollToOffset({ offset: 0, animated: true });
          }}
        />
      ) : (
        <View style={[styles.notice, { paddingBottom: bottom + space.xs }]}>
          <Text variant="small" tone="muted" center>
            {room.stopped === "restricted"
              ? t("restrictedNotice")
              : room.stopped
                ? t("blockedNotice")
                : t("adminView")}
          </Text>
        </View>
      )}

      <MessageSheet
        visible={selected !== null}
        title={selected?.name ?? ""}
        preview={selected?.body ?? ""}
        cancelLabel={tCommon("cancel")}
        onClose={() => setSelected(null)}
        actions={
          selected
            ? [
                {
                  key: "copy",
                  label: t("copy"),
                  icon: (c) => <Copy size={18} color={c} />,
                  onPress: () => {
                    void Clipboard.setStringAsync(selected.body);
                    setSelected(null);
                  },
                },
                ...(canDelete(selected)
                  ? [
                      {
                        key: "delete",
                        label: t("delete"),
                        destructive: true,
                        icon: (c: string) => <Trash2 size={18} color={c} />,
                        onPress: () => void remove(selected),
                      },
                    ]
                  : []),
              ]
            : []
        }
      />
    </KeyboardAvoidingView>
  );
}

/** The on-screen keyboard is up (the composer then drops its safe-area pad). */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      () => setShown(true),
    );
    const hide = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => setShown(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate100 },
  flex: { flex: 1 },
  title: { maxWidth: 240, minHeight: TOUCH, justifyContent: "center" },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 2 },
  titleText: { flexShrink: 1, fontSize: 17, color: colors.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 2 },
  liveIcon: { padding: 4 },
  iconButton: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPressed: { backgroundColor: colors.slate100 },
  listContent: { paddingVertical: space.md },
  older: { paddingVertical: space.lg },
  listEnd: { height: space.sm },
  emptyWrap: { flex: 1, alignItems: "center", paddingTop: 40 },
  emptyCard: {
    maxWidth: 320,
    marginHorizontal: space.lg,
    padding: space.lg,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  notice: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate200,
  },
});
