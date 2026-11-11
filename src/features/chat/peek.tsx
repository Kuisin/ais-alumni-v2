import type { ChatList, ChatListRow, ChatRoom } from "@contract/chat";
import type { Locale } from "@contract/core";
import type { ChatNotifyLevel } from "@contract/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { useChatNotifyLevel } from "@/features/notifications/api";
import { useMe } from "@/lib/auth";
import { Avatar, Button, colors, space, Text } from "@/ui";
import { Sheet } from "@/ui/sheet";
import {
  CHAT_LIST_KEY,
  chatApi,
  fetchRoom,
  infoKey,
  roomKey,
  useChatRoom,
  useRefreshChatBadges,
} from "./api";
import { showError } from "./dialogs";
import { timeOfDay } from "./time";

/**
 * A peek at a talk from the chat list (long press), as in LINE: the
 * latest messages without opening the talk — so nothing is marked read and
 * the sender sees no 既読 — plus quick actions. iOS: the native context
 * menu's preview and menu (chat-list.tsx, Link.Preview / Link.Menu);
 * Android, the web and wide windows: ChatPeekSheet.
 *
 * Only GETs here (GET /chat/:id never marks read: that's POST /read, sent
 * by useRoom while the talk is in front, or by 既読にする below).
 */

/** Messages shown in a peek. */
const PEEK_COUNT = 15;

/** The cached talk, if it was loaded (the iOS menu's notification state). */
export function useCachedRoom(id: string): ChatRoom | undefined {
  return useQuery({
    queryKey: roomKey(id),
    queryFn: () => fetchRoom(id),
    enabled: false,
  }).data;
}

/**
 * The peek's actions: 既読にする, notifications (a group's level / a 1:1
 * talk's daily digest), トークの詳細.
 */
export function useChatQuickActions(row: ChatListRow) {
  const tm = useTranslations("mobile");
  const router = useRouter();
  const queryClient = useQueryClient();
  const refreshBadges = useRefreshChatBadges();
  const level = useChatNotifyLevel(row.id);
  const id = row.id;

  const markRead = () => {
    queryClient.setQueryData<ChatList>(
      CHAT_LIST_KEY,
      (list) =>
        list && {
          ...list,
          rows: list.rows.map((r) =>
            r.id === id ? { ...r, unread: 0, mentioned: false } : r,
          ),
        },
    );
    chatApi.markRead(id).then(
      () => {
        refreshBadges();
        void queryClient.invalidateQueries({ queryKey: roomKey(id) });
      },
      () => {
        refreshBadges();
        showError(tm("errors.generic"));
      },
    );
  };

  const setLevel = (next: ChatNotifyLevel) => {
    level.mutate(next, {
      onSuccess: () =>
        void queryClient.invalidateQueries({ queryKey: infoKey(id) }),
      onError: () => showError(tm("errors.generic")),
    });
  };

  /** 1:1 talks: the daily digest (muted = off). */
  const setMuted = (muted: boolean) => {
    chatApi.mute(id, muted).then(
      () => {
        queryClient.setQueryData<ChatRoom>(
          roomKey(id),
          (room) => room && { ...room, muted },
        );
        void queryClient.invalidateQueries({ queryKey: infoKey(id) });
      },
      () => showError(tm("errors.generic")),
    );
  };

  const openInfo = () =>
    router.push({ pathname: "/chat/[id]/info", params: { id } });

  return {
    /** only a member's unread talk */
    canMarkRead: row.joined && row.unread > 0,
    /** members only (admins looking into a group have no settings) */
    canNotify: row.joined,
    markRead,
    setLevel,
    setMuted,
    openInfo,
  };
}

/**
 * The latest messages of a talk, read-only: newest at the bottom, the
 * oldest cut off at the top, 「ここから未読」 where the unread ones start.
 */
export function ChatPeek({ id, height }: { id: string; height?: number }) {
  const t = useTranslations("chat");
  const tm = useTranslations("mobile.chat.peek");
  const locale = useLocale() as Locale;
  const me = useMe().user.id;
  const query = useChatRoom(id);
  const room = query.data;

  let body: ReactNode;
  if (!room) {
    body = query.isError ? (
      <Text tone="muted" center>
        {tm("error")}
      </Text>
    ) : (
      <ActivityIndicator color={colors.brand700} />
    );
  } else if (!room.messages.length) {
    body = (
      <Text tone="muted" center>
        {tm("empty")}
      </Text>
    );
  } else {
    const shown = room.messages.slice(-PEEK_COUNT);
    const since = room.lastReadAt;
    const firstUnread = room.member
      ? shown.find((m) => (!since || m.createdAt > since) && m.userId !== me)
          ?.id
      : undefined;
    body = shown.map((m, i) => {
      const mine = m.userId === me;
      const runStart = i === 0 || shown[i - 1].userId !== m.userId;
      return (
        <View key={m.id}>
          {m.id === firstUnread ? (
            <View style={styles.divider}>
              <Text variant="caption" weight="semibold" style={styles.unread}>
                {t("room.unreadDivider")}
              </Text>
            </View>
          ) : null}
          <View style={[styles.message, mine ? styles.messageMine : null]}>
            {!mine ? (
              runStart || m.id === firstUnread ? (
                <Avatar uri={m.avatar} size={28} />
              ) : (
                <View style={styles.avatarSpace} />
              )
            ) : null}
            <View style={[styles.column, mine ? styles.columnMine : null]}>
              {!mine && !room.direct && (runStart || m.id === firstUnread) ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {m.name}
                </Text>
              ) : null}
              <View style={[styles.line, mine ? styles.lineMine : null]}>
                <View
                  style={[
                    styles.bubble,
                    m.deleted
                      ? styles.deleted
                      : mine
                        ? styles.bubbleMine
                        : styles.bubbleOther,
                  ]}
                >
                  <Text
                    numberOfLines={4}
                    style={[
                      styles.body,
                      mine && !m.deleted ? styles.bodyMine : null,
                      m.deleted ? styles.italic : null,
                    ]}
                  >
                    {m.deleted ? t("room.deleted") : m.body}
                  </Text>
                </View>
                <Text style={styles.time}>
                  {timeOfDay(m.createdAt, locale)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    });
  }

  return (
    <View
      style={[styles.peek, height ? { height } : styles.fill]}
      accessibilityLabel={tm("label")}
    >
      <View style={styles.messages}>{body}</View>
    </View>
  );
}

/**
 * Android, the web and wide windows: the peek in a sheet, with 開く and
 * the same actions as the iOS menu.
 */
export function ChatPeekSheet({
  row,
  onClose,
  onOpen,
}: {
  /** the talk shown; null = closed */
  row: ChatListRow | null;
  onClose: () => void;
  onOpen: (row: ChatListRow) => void;
}) {
  return (
    <Sheet visible={row !== null} onClose={onClose} title={row?.name}>
      {row ? (
        <PeekSheetBody
          key={row.id}
          row={row}
          onClose={onClose}
          onOpen={onOpen}
        />
      ) : null}
    </Sheet>
  );
}

function PeekSheetBody({
  row,
  onClose,
  onOpen,
}: {
  row: ChatListRow;
  onClose: () => void;
  onOpen: (row: ChatListRow) => void;
}) {
  const tm = useTranslations("mobile.chat.peek");
  const tc = useTranslations("chat");
  const actions = useChatQuickActions(row);
  const room = useCachedRoom(row.id);
  const after = (run: () => void) => () => {
    onClose();
    run();
  };

  return (
    <View style={styles.sheet}>
      <ChatPeek id={row.id} height={320} />
      <Text variant="caption" tone="subtle" center>
        {tm("notRead")}
      </Text>
      <Button label={tm("open")} onPress={after(() => onOpen(row))} />
      {actions.canMarkRead ? (
        <Button
          variant="secondary"
          label={tm("markRead")}
          onPress={after(actions.markRead)}
        />
      ) : null}
      {actions.canNotify && room ? (
        room.direct ? (
          <Button
            variant="secondary"
            label={room.muted ? tm("digestOn") : tm("digestOff")}
            onPress={after(() => actions.setMuted(!room.muted))}
          />
        ) : (
          <Button
            variant="secondary"
            label={
              room.notifyLevel === "off" ? tm("notifyOn") : tm("notifyOff")
            }
            onPress={after(() =>
              actions.setLevel(room.notifyLevel === "off" ? "mentions" : "off"),
            )}
          />
        )
      ) : null}
      <Button
        variant="ghost"
        label={tc("info.open")}
        onPress={after(actions.openInfo)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  peek: {
    overflow: "hidden",
    backgroundColor: colors.slate100,
    borderRadius: 12,
  },
  // Newest at the bottom; what doesn't fit is cut off at the top.
  messages: {
    flex: 1,
    justifyContent: "flex-end",
    gap: space.xs,
    padding: space.md,
  },
  divider: { alignItems: "center", marginVertical: space.xs },
  unread: { color: colors.red700 },
  message: { flexDirection: "row", alignItems: "flex-start", gap: space.xs },
  messageMine: { justifyContent: "flex-end" },
  avatarSpace: { width: 28 },
  column: { flexShrink: 1, gap: 2, maxWidth: "82%" },
  columnMine: { alignItems: "flex-end" },
  line: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  lineMine: { flexDirection: "row-reverse" },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 1,
  },
  bubbleMine: { backgroundColor: colors.brand700 },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slate200,
  },
  deleted: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.slate300,
  },
  body: { fontSize: 14, lineHeight: 20, color: colors.slate900 },
  bodyMine: { color: colors.white },
  italic: { fontStyle: "italic", color: colors.slate500 },
  time: { fontSize: 10, lineHeight: 13, color: colors.slate500 },
  sheet: { gap: space.md },
});
