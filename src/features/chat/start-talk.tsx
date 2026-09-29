import type { DirectCandidate, DirectCandidates } from "@contract/chat";
import { Stack, useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useTranslations } from "use-intl";
import {
  Avatar,
  Button,
  colors,
  QueryState,
  ScreenView,
  space,
  Text,
} from "@/ui";
import { useDirectCandidates, useStartTalk } from "./api";

/**
 * 新しいトーク (the website's /app/chat/new): start a 1:1 talk with a
 * mutual follower, as the member types allow.
 */
export function NewTalkScreen() {
  const t = useTranslations("chat.new");
  const query = useDirectCandidates();
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <ScreenView>
        <QueryState query={query}>
          {(data) => <NewTalkBody data={data} refetch={query.refetch} />}
        </QueryState>
      </ScreenView>
    </>
  );
}

function NewTalkBody({
  data,
  refetch,
}: {
  data: DirectCandidates;
  refetch: () => Promise<unknown>;
}) {
  const t = useTranslations("chat.new");
  const router = useRouter();
  const { open, pending, error } = useStartTalk({ replace: true });
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch().catch(() => {});
    setRefreshing(false);
  };

  const people = data.available ? data.people : [];
  return (
    <FlatList
      data={people}
      keyExtractor={(p) => p.id}
      renderItem={({ item, index }) => (
        <PersonRow
          person={item}
          first={index === 0}
          last={index === people.length - 1}
          busy={pending === item.id}
          disabled={pending !== null}
          onPress={() => void open(item.id)}
        />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text variant="small" tone="muted">
            {t("hint")}
          </Text>
          {error ? (
            <View style={styles.alert} accessibilityRole="alert">
              <Text variant="small" tone="danger">
                {error}
              </Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.box}>
          {!data.available ? (
            <Text variant="small" weight="medium" tone="muted" center>
              {t("restricted")}
            </Text>
          ) : (
            <>
              <Text variant="small" weight="medium" tone="muted" center>
                {t("empty")}
              </Text>
              <Text variant="small" tone="muted" center>
                {t("emptyHint")}
              </Text>
              <Button
                variant="secondary"
                label={t("findMembers")}
                onPress={() => router.push("/directory")}
                style={styles.find}
              />
            </>
          )}
        </View>
      }
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

function PersonRow({
  person: p,
  first,
  last,
  busy,
  disabled,
  onPress,
}: {
  person: DirectCandidate;
  first: boolean;
  last: boolean;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[p.name, p.kanji].filter(Boolean).join(", ")}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        first ? styles.rowFirst : styles.rowBorder,
        last ? styles.rowLast : null,
        disabled && !busy ? styles.dim : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Avatar uri={p.avatar} size={44} />
      <View style={styles.names}>
        <Text weight="semibold" numberOfLines={1}>
          {p.name}
        </Text>
        {p.kanji ? (
          <Text variant="small" tone="subtle" numberOfLines={1}>
            {p.kanji}
          </Text>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator color={colors.brand700} />
      ) : (
        <MessageCircle size={20} color={colors.brand700} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.md, marginBottom: space.md },
  alert: {
    borderRadius: 10,
    padding: space.md,
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: colors.red100,
  },
  box: {
    gap: space.xs,
    padding: space.xl,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slate200,
  },
  find: { marginTop: space.md, alignSelf: "center" },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slate200,
  },
  rowFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate100,
  },
  rowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  dim: { opacity: 0.6 },
  pressed: { backgroundColor: colors.slate50 },
  names: { flex: 1, minWidth: 0 },
});
