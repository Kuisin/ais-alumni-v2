import type { VerificationTab } from "@contract/admin";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ListChecks, Search } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useVerificationQueue } from "@/features/admin/verification/api";
import { QueueRow } from "@/features/admin/verification/queue-row";
import {
  Button,
  CountDot,
  colors,
  EmptyState,
  ErrorState,
  ListGroup,
  Loading,
  radius,
  Screen,
  Separator,
  space,
  Text,
  TextField,
} from "@/ui";

const TABS: VerificationTab[] = ["pending", "needsInfo"];

/**
 * 本人確認 queue (the website's /app/admin/verification): open
 * applications, oldest first — 審査待ち or waiting on the applicant
 * (?tab=needsInfo) — with a name search and 20 per page.
 */
export default function VerificationQueueScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const t = useTranslations("adminVerify");
  const router = useRouter();
  const [tab, setTab] = useState<VerificationTab>(
    params.tab === "needsInfo" ? "needsInfo" : "pending",
  );
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useVerificationQueue(tab, q, page);
  const [refreshing, setRefreshing] = useState(false);
  const data = query.data;

  const choose = (next: VerificationTab) => {
    setTab(next);
    setPage(1);
  };
  const search = () => {
    setQ(draft.trim().slice(0, 60));
    setPage(1);
  };
  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: t("queue.title") }} />
      <Text variant="small" tone="muted">
        {t("queue.description")}
      </Text>

      <View
        style={styles.tabs}
        accessibilityRole="tablist"
        accessibilityLabel={t("queue.tabsLabel")}
      >
        {TABS.map((key) => {
          const on = key === tab;
          const n = data?.counts[key] ?? 0;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t(`queue.tabs.${key}`)} ${n}`}
              onPress={() => choose(key)}
              style={({ pressed }) => [
                styles.tab,
                on ? styles.tabOn : null,
                pressed && !on ? styles.tabPressed : null,
              ]}
            >
              <Text
                variant="small"
                weight="semibold"
                style={{ color: on ? colors.white : colors.slate700 }}
              >
                {t(`queue.tabs.${key}`)}
              </Text>
              <CountDot count={n} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.search}>
        <View style={styles.searchField}>
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder={t("queue.searchPlaceholder")}
            accessibilityLabel={t("queue.search")}
            returnKeyType="search"
            onSubmitEditing={search}
            maxLength={60}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Button
          label={t("queue.search")}
          variant="secondary"
          icon={(c) => <Search size={16} color={c} aria-hidden />}
          onPress={search}
        />
      </View>

      {!data ? (
        query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <Loading inline />
        )
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={32} color={colors.slate400} />}
          title={t("queue.empty")}
          hint={
            data.tab === "pending"
              ? t("queue.emptyHint")
              : t("queue.emptyNeedsInfoHint")
          }
        />
      ) : (
        <ListGroup>
          {data.items.map((item, i) => (
            <View key={item.id}>
              {i > 0 ? <Separator /> : null}
              <QueueRow
                item={item}
                onPress={() =>
                  router.push({
                    pathname: "/admin/verification/[id]",
                    params: { id: item.id },
                  })
                }
              />
            </View>
          ))}
        </ListGroup>
      )}

      {data && data.pages > 1 ? (
        <View
          style={styles.pager}
          accessibilityRole="toolbar"
          accessibilityLabel={t("queue.pagination")}
        >
          <Button
            label={t("queue.prev")}
            variant="secondary"
            compact
            disabled={data.page <= 1}
            onPress={() => setPage(data.page - 1)}
          />
          <Text variant="small" tone="muted">
            {t("queue.pageOf", { page: data.page, pages: data.pages })}
          </Text>
          <Button
            label={t("queue.next")}
            variant="secondary"
            compact
            disabled={data.page >= data.pages}
            onPress={() => setPage(data.page + 1)}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tab: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
  },
  tabOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  tabPressed: { backgroundColor: colors.slate100 },
  search: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  searchField: { flex: 1 },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
});
