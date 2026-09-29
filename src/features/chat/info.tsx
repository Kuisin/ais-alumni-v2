import type { ChatInfo, ChatInfoMember } from "@contract/chat";
import type { ChatNotifyLevel } from "@contract/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, Flag, Search, Users } from "lucide-react-native";
import { Fragment, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useTranslations } from "use-intl";
import { ChoiceRow } from "@/features/me/rows";
import { useChatNotifyLevel } from "@/features/notifications/api";
import { hrefFor } from "@/lib/links";
import { usePush } from "@/lib/push";
import {
  Avatar,
  Button,
  Card,
  colors,
  ListGroup,
  QueryState,
  ScreenView,
  Separator,
  space,
  Text,
  TOUCH,
} from "@/ui";
import { chatApi, infoKey, roomKey, useChatInfo } from "./api";
import { showError } from "./dialogs";
import { MemberTags } from "./member-tags";
import { toKatakana } from "./mentions";

/**
 * トークの詳細 (the website's /app/chat/[id]/info): what the talk is, its
 * members (search; tap for a profile where the member may see it), its
 * notifications and 「問題を報告する」 for members of the talk.
 */
export function ChatInfoScreen() {
  const t = useTranslations("chat.info");
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useChatInfo(id);
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <ScreenView>
        <QueryState query={query}>
          {(info) => <InfoBody info={info} refetch={query.refetch} />}
        </QueryState>
      </ScreenView>
    </>
  );
}

function InfoBody({
  info,
  refetch,
}: {
  info: ChatInfo;
  refetch: () => Promise<unknown>;
}) {
  const t = useTranslations("chat");
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const term = q.trim().toLowerCase();
  const kana = term ? toKatakana(term) : "";
  const shown = term
    ? info.members.filter(
        (m) =>
          `${m.name} ${m.otherNames ?? ""}`.toLowerCase().includes(term) ||
          (m.otherNames ?? "").includes(kana),
      )
    : info.members;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <FlatList
      data={shown}
      keyExtractor={(m) => m.id}
      renderItem={({ item, index }) => (
        <MemberRow
          member={item}
          first={index === 0}
          last={index === shown.length - 1}
        />
      )}
      ItemSeparatorComponent={MemberSeparator}
      ListHeaderComponent={
        <View style={styles.header}>
          <Card style={styles.hero}>
            {info.partner ? (
              <Avatar uri={info.partner.avatar} size={88} />
            ) : (
              <View style={styles.groupIcon}>
                <Users size={36} color={colors.brand700} />
              </View>
            )}
            <Text variant="heading" center accessibilityRole="header">
              {info.title}
            </Text>
            {info.hint ? (
              <Text variant="small" tone="muted" center>
                {info.hint}
              </Text>
            ) : null}
          </Card>
          <Text variant="subheading" accessibilityRole="header">
            {t("members", { count: info.memberCount })}
          </Text>
          {info.members.length > 8 ? (
            <View style={styles.search}>
              <Search size={16} color={colors.slate400} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={t("info.search")}
                placeholderTextColor={colors.slate400}
                accessibilityLabel={t("info.search")}
                autoCorrect={false}
                autoComplete="off"
                clearButtonMode="while-editing"
                returnKeyType="search"
                style={styles.searchInput}
              />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <Text variant="small" tone="muted" center style={styles.noMatch}>
          {t("info.noMatch")}
        </Text>
      }
      ListFooterComponent={info.member ? <MemberSettings info={info} /> : null}
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

function MemberSeparator() {
  return (
    <View style={styles.separatorWrap}>
      <View style={styles.separator} />
    </View>
  );
}

function MemberRow({
  member: m,
  first,
  last,
}: {
  member: ChatInfoMember;
  first: boolean;
  last: boolean;
}) {
  const t = useTranslations("chat");
  const router = useRouter();
  const body = (
    <>
      <Avatar uri={m.avatar} size={44} />
      <View style={styles.memberText}>
        <View style={styles.nameLine}>
          <Text weight="medium" numberOfLines={1} style={styles.shrink}>
            {m.name}
          </Text>
          {m.self ? (
            <View style={styles.youTag}>
              <Text style={styles.youText}>{t("you")}</Text>
            </View>
          ) : null}
          <MemberTags cohort={m.cohort} rep={m.rep} />
        </View>
        {m.otherNames ? (
          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {m.otherNames}
          </Text>
        ) : null}
      </View>
    </>
  );
  const shape = [
    styles.member,
    first ? styles.memberFirst : null,
    last ? styles.memberLast : null,
  ];
  if (!m.linked) return <View style={shape}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[m.name, m.self ? t("you") : null, m.otherNames]
        .filter(Boolean)
        .join(", ")}
      onPress={() => router.push(hrefFor(`/app/members/${m.id}`))}
      style={({ pressed }) => [...shape, pressed ? styles.pressed : null]}
    >
      {body}
      <ChevronRight size={16} color={colors.slate400} />
    </Pressable>
  );
}

/**
 * Notifications and the report entry (members of the talk only). Groups:
 * the notification level (every message / mentions / off — see
 * ChatNotifyLevel); 1:1 talks, which always notify: the daily digest.
 */
function MemberSettings({ info }: { info: ChatInfo }) {
  const t = useTranslations("chat");
  const tm = useTranslations("mobile");
  const router = useRouter();

  return (
    <View style={styles.settings}>
      <Text variant="subheading" accessibilityRole="header">
        {tm("chat.notifications")}
      </Text>
      {info.direct ? <DigestSwitch info={info} /> : <LevelChoice info={info} />}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: "/chat/[id]/report",
            params: { id: info.id },
          })
        }
        style={({ pressed }) => [
          styles.box,
          styles.reportRow,
          pressed ? styles.pressed : null,
        ]}
      >
        <Flag size={18} color={colors.red700} />
        <Text weight="semibold" tone="danger" style={styles.flex}>
          {t("report.open")}
        </Text>
        <ChevronRight size={16} color={colors.slate400} />
      </Pressable>
    </View>
  );
}

function DigestSwitch({ info }: { info: ChatInfo }) {
  const t = useTranslations("chat");
  const tm = useTranslations("mobile");
  const queryClient = useQueryClient();
  const [muted, setMuted] = useState(info.muted);
  const [saving, setSaving] = useState(false);

  const toggle = async (digest: boolean) => {
    const next = !digest;
    setMuted(next);
    setSaving(true);
    try {
      await chatApi.mute(info.id, next);
      void queryClient.invalidateQueries({ queryKey: infoKey(info.id) });
      void queryClient.invalidateQueries({ queryKey: roomKey(info.id) });
    } catch {
      setMuted(!next);
      showError(tm("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.box}>
      <View style={styles.switchRow}>
        <Text variant="small" style={styles.flex}>
          {t("room.digest")}
        </Text>
        <Switch
          value={!muted}
          onValueChange={toggle}
          disabled={saving}
          accessibilityLabel={t("room.digest")}
          trackColor={{ true: colors.brand600, false: colors.slate300 }}
          thumbColor={colors.white}
        />
      </View>
    </View>
  );
}

const LEVELS: ChatNotifyLevel[] = ["all", "mentions", "off"];

function LevelChoice({ info }: { info: ChatInfo }) {
  const t = useTranslations("mobile.chat.levels");
  const tm = useTranslations("mobile");
  const router = useRouter();
  const push = usePush();
  const save = useChatNotifyLevel(info.id);
  const shown = save.isPending ? save.variables : info.notifyLevel;

  const choose = (level: ChatNotifyLevel) => {
    if (save.isPending || level === info.notifyLevel) return;
    save.mutate(level, {
      onError: () => showError(tm("errors.generic")),
    });
  };

  return (
    <>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={tm("chat.notifications")}
      >
        <ListGroup>
          {LEVELS.map((level, i) => (
            <Fragment key={level}>
              {i ? <Separator /> : null}
              <ChoiceRow
                title={t(level)}
                hint={t(`${level}Hint`)}
                selected={shown === level}
                busy={save.isPending && save.variables === level}
                disabled={save.isPending}
                onPress={() => choose(level)}
              />
            </Fragment>
          ))}
        </ListGroup>
      </View>
      {push.blocker === null && !push.enabled ? (
        <View style={styles.pushOff}>
          <Text variant="small" tone="muted" style={styles.flex}>
            {t("pushOff")}
          </Text>
          <Button
            variant="ghost"
            compact
            label={t("openSettings")}
            onPress={() => router.push("/settings")}
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.md, marginBottom: space.sm },
  hero: { alignItems: "center", gap: space.sm, paddingVertical: space.xl },
  groupIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand50,
  },
  search: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    minHeight: TOUCH,
    paddingRight: space.md,
    fontSize: 16,
    color: colors.text,
  },
  noMatch: { paddingVertical: space.lg },
  member: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slate200,
  },
  memberFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  memberLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  pressed: { backgroundColor: colors.slate50 },
  memberText: { flex: 1, minWidth: 0, gap: 2 },
  nameLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  shrink: { flexShrink: 1, color: colors.slate900 },
  youTag: {
    borderRadius: 4,
    paddingHorizontal: 6,
    backgroundColor: colors.slate100,
  },
  youText: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "500",
    color: colors.slate600,
  },
  separatorWrap: {
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slate200,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: space.md + 44 + space.md,
    backgroundColor: colors.slate100,
  },
  settings: { gap: space.md, marginTop: space.xl },
  box: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slate200,
  },
  switchRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  reportRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  pushOff: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
});
