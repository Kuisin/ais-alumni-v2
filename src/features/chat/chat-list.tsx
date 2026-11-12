import type { ChatList, ChatListRow } from "@contract/chat";
import type { Locale } from "@contract/core";
import {
  Link,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { MessageCirclePlus, Search, Users } from "lucide-react-native";
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type AccessibilityActionEvent,
  type HostInstance,
  Platform,
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
  Button,
  colors,
  EmptyState,
  Panes,
  QueryState,
  ScreenView,
  space,
  Text,
  TOUCH,
} from "@/ui";
import { useChatList } from "./api";
import {
  ChatPeek,
  ChatPeekSheet,
  useCachedRoom,
  useChatQuickActions,
} from "./peek";
import { ChatRoomPane } from "./room/chat-room";
import { listTime } from "./time";

type Filter = "all" | "direct" | "groups";

const POLL_MS = 20_000;

/**
 * iOS: long press is the system's context menu with a preview of the talk
 * (Link.Preview / Link.Menu). Elsewhere — and in the side-by-side layout,
 * where a row selects instead of opening — it opens ChatPeekSheet.
 */
const NATIVE_PEEK = Platform.OS === "ios";

/** Height of the iOS context-menu preview. */
const PREVIEW_HEIGHT = 460;

/**
 * チャット (the website's /app/chat): talks and group chats, newest
 * activity first — search, filter chips, unread counts, 「あなた宛」 for
 * mentions; admins also see the groups they're not in. 「新しいトーク」 is
 * at the top of the list. On a wide window the selected talk (?room=) is
 * beside the list (Panes).
 */
export function ChatListScreen() {
  const tm = useTranslations("mobile.chat");
  const { room } = useLocalSearchParams<{ room?: string }>();
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
      <Panes
        list={(wide) => (
          <>
            {!wide && room ? <OpenFullScreen id={room} /> : null}
            <QueryState query={list}>
              {(data) => (
                <ChatListBody
                  data={data}
                  refetch={refetch}
                  selected={wide ? (room ?? null) : undefined}
                />
              )}
            </QueryState>
          </>
        )}
        detail={
          room ? (
            <ChatRoomPane key={room} id={room} />
          ) : (
            <View style={styles.pick}>
              <EmptyState title={tm("pickTalk")} />
            </View>
          )
        }
      />
    </ScreenView>
  );
}

/**
 * The window narrowed (the iPhone Duo closed) with a talk in the pane:
 * it goes on full screen.
 */
function OpenFullScreen({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => {
    router.setParams({ room: undefined });
    router.push({ pathname: "/chat/[id]", params: { id } });
  }, [id, router]);
  return null;
}

function ChatListBody({
  data,
  refetch,
  selected,
}: {
  data: ChatList;
  refetch: () => Promise<unknown>;
  /** side by side (Panes): the talk in the pane — rows select instead of opening */
  selected?: string | null;
}) {
  const t = useTranslations("chat");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [peek, setPeek] = useState<ChatListRow | null>(null);
  const router = useRouter();
  const open = useCallback(
    (r: ChatListRow) =>
      selected === undefined
        ? router.push({ pathname: "/chat/[id]", params: { id: r.id } })
        : router.setParams({ room: r.id }),
    [router, selected],
  );

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
    <>
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <ChatRowItem
            row={item}
            selected={selected === undefined ? undefined : selected === item.id}
            onOpen={open}
            onPeek={setPeek}
          />
        )}
        extraData={selected}
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
            {data.canStartDirect ? (
              <Button
                variant="secondary"
                label={t("newTalk")}
                icon={(color) => (
                  <MessageCirclePlus size={20} color={color} aria-hidden />
                )}
                onPress={() => router.push("/chat/new")}
              />
            ) : null}
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
      <ChatPeekSheet row={peek} onClose={() => setPeek(null)} onOpen={open} />
    </>
  );
}

function RowSeparator() {
  return <View style={styles.separator} />;
}

function ChatRowItem({
  row: r,
  selected,
  onOpen,
  onPeek,
}: {
  row: ChatListRow;
  /** side by side: whether it's the talk in the pane (undefined: not) */
  selected?: boolean;
  onOpen: (row: ChatListRow) => void;
  /** long press without the native preview: the peek sheet */
  onPeek: (row: ChatListRow) => void;
}) {
  const t = useTranslations("chat");
  const tm = useTranslations("mobile.chat");
  const locale = useLocale() as Locale;
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
  const content = (
    <>
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
    </>
  );
  // VoiceOver / TalkBack: 「プレビュー」 in the actions rotor opens the sheet.
  const a11y = {
    label,
    hint: tm("peek.hint"),
    actionLabel: tm("peek.action"),
    onAction: () => onPeek(r),
  };

  if (NATIVE_PEEK && selected === undefined)
    return (
      <NativePeekRow row={r} a11y={a11y}>
        {content}
      </NativePeekRow>
    );

  return (
    <RowButton
      a11y={a11y}
      selected={selected}
      onPress={() => onOpen(r)}
      onLongPress={() => onPeek(r)}
    >
      {content}
    </RowButton>
  );
}

type RowA11y = {
  label: string;
  hint: string;
  actionLabel: string;
  onAction: () => void;
};

/**
 * The row's pressable. Also Link.Trigger's child (iOS), which hands it
 * onPress (and a style of its own, ignored here).
 */
function RowButton({
  a11y,
  selected,
  onPress,
  onLongPress,
  ref,
  children,
}: {
  a11y: RowA11y;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  ref?: Ref<HostInstance>;
  children: ReactNode;
}) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={a11y.label}
      accessibilityHint={a11y.hint}
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityActions={[{ name: "preview", label: a11y.actionLabel }]}
      onAccessibilityAction={(e: AccessibilityActionEvent) => {
        if (e.nativeEvent.actionName === "preview") a11y.onAction();
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.rowSelected : pressed ? styles.rowPressed : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

/**
 * iOS: tap opens the talk; long press is the system's context menu with
 * the latest messages (ChatPeek — not marked read) and the quick actions.
 * Tapping the preview opens the talk, which then marks it read as usual.
 */
function NativePeekRow({
  row: r,
  a11y,
  children,
}: {
  row: ChatListRow;
  a11y: RowA11y;
  children: ReactNode;
}) {
  const t = useTranslations("chat");
  const tm = useTranslations("mobile.chat");
  const tl = useTranslations("mobile.chat.levels");
  const actions = useChatQuickActions(r);
  // Known once the preview has loaded it (or the talk was opened before).
  const room = useCachedRoom(r.id);
  return (
    <Link href={{ pathname: "/chat/[id]", params: { id: r.id } }} push asChild>
      <Link.Trigger>
        <RowButton a11y={a11y}>{children}</RowButton>
      </Link.Trigger>
      <Link.Preview style={{ height: PREVIEW_HEIGHT }}>
        <ChatPeek id={r.id} height={PREVIEW_HEIGHT} />
      </Link.Preview>
      <Link.Menu>
        {actions.canMarkRead ? (
          <Link.MenuAction icon="checkmark.circle" onPress={actions.markRead}>
            {tm("peek.markRead")}
          </Link.MenuAction>
        ) : null}
        {actions.canNotify && r.direct ? (
          <Link.Menu title={tm("peek.digest")} icon="bell">
            <Link.MenuAction
              isOn={room ? !room.muted : false}
              onPress={() => actions.setMuted(false)}
            >
              {tm("peek.on")}
            </Link.MenuAction>
            <Link.MenuAction
              isOn={room ? room.muted : false}
              onPress={() => actions.setMuted(true)}
            >
              {tm("peek.off")}
            </Link.MenuAction>
          </Link.Menu>
        ) : null}
        {actions.canNotify && !r.direct ? (
          <Link.Menu title={tm("notifications")} icon="bell">
            <Link.MenuAction
              isOn={room?.notifyLevel === "all"}
              onPress={() => actions.setLevel("all")}
            >
              {tl("all")}
            </Link.MenuAction>
            <Link.MenuAction
              isOn={room?.notifyLevel === "mentions"}
              onPress={() => actions.setLevel("mentions")}
            >
              {tl("mentions")}
            </Link.MenuAction>
            <Link.MenuAction
              isOn={room?.notifyLevel === "off"}
              onPress={() => actions.setLevel("off")}
            >
              {tl("off")}
            </Link.MenuAction>
          </Link.Menu>
        ) : null}
        <Link.MenuAction icon="info.circle" onPress={actions.openInfo}>
          {t("info.open")}
        </Link.MenuAction>
      </Link.Menu>
    </Link>
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
  rowSelected: { backgroundColor: colors.brand50 },
  pick: { flex: 1, justifyContent: "center", padding: space.lg },
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
