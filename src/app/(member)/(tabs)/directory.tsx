import { useRouter } from "expo-router";
import { SearchX, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useTranslations } from "use-intl";
import {
  type DirectoryForm,
  EMPTY_FORM,
  useDirectory,
  useDirectoryOptions,
} from "@/features/people/api";
import { DirectorySearch } from "@/features/people/directory-filters";
import { MemberCardView } from "@/features/people/member-card";
import { useMe } from "@/lib/auth";
import { hrefFor } from "@/lib/links";
import {
  Button,
  colors,
  EmptyState,
  ErrorState,
  Loading,
  ScreenView,
  space,
  Text,
} from "@/ui";

/**
 * 会員名簿 (the website's /app/directory): search by name, 区分 and the
 * other filters; 24 members at a time, more as you scroll. Who is listed —
 * and each photo — is decided by the server (searchDirectory, photoFor).
 */
export default function DirectoryTab() {
  const t = useTranslations("directory");
  const tm = useTranslations("mobile.errors");
  const router = useRouter();
  const me = useMe();
  const options = useDirectoryOptions();
  const [form, setForm] = useState<DirectoryForm>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const list = useDirectory(form);

  // The name applies after a short pause in typing (or on 検索).
  useEffect(() => {
    if (query.trim() === form.q.trim()) return;
    const timer = setTimeout(() => setForm((f) => ({ ...f, q: query })), 450);
    return () => clearTimeout(timer);
  }, [query, form.q]);

  const change = (f: DirectoryForm) => {
    setForm(f);
    setQuery(f.q);
  };

  const pages = list.data?.pages ?? [];
  const first = pages[0];
  const items = pages.flatMap((p) => p.items);
  const loadingNew = list.isPlaceholderData;

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([list.refetch(), options.refetch()]).catch(() => {});
    setRefreshing(false);
  };

  const open = (id: string) =>
    router.push(
      id === me.user.id
        ? hrefFor("/app/profile")
        : { pathname: "/members/[id]", params: { id } },
    );

  return (
    <ScreenView>
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={loadingNew ? styles.dim : null}>
            <MemberCardView member={item} onPress={() => open(item.id)} />
          </View>
        )}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="small" tone="muted">
              {t("description")}
            </Text>
            <DirectorySearch
              query={query}
              onQuery={setQuery}
              onSubmit={() => setForm((f) => ({ ...f, q: query }))}
              form={form}
              applied={first?.filters}
              options={options.data}
              onChange={change}
            />
            {first ? (
              <View style={styles.results}>
                <Text variant="small" weight="medium" tone="muted">
                  {t("results")}
                </Text>
                <Text
                  variant="small"
                  weight="semibold"
                  accessibilityLiveRegion="polite"
                >
                  {t("count", { count: first.total })}
                </Text>
                {loadingNew ? (
                  <ActivityIndicator size="small" color={colors.brand700} />
                ) : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          list.isPending ? (
            <Loading inline />
          ) : list.isError && !first ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : first?.filtered ? (
            <EmptyState
              icon={<SearchX size={32} color={colors.slate400} />}
              title={t("empty")}
              action={
                <Button
                  variant="secondary"
                  label={t("filters.clear")}
                  onPress={() => change(EMPTY_FORM)}
                />
              }
            />
          ) : (
            <EmptyState
              icon={<Users size={32} color={colors.slate400} />}
              title={t("emptyAll")}
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
          ) : list.hasNextPage ? (
            <View style={styles.footer}>
              <Button
                variant="secondary"
                label={t("loadMore")}
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
  header: { gap: space.md, marginBottom: space.md },
  results: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xs,
  },
  dim: { opacity: 0.5 },
  gap: { height: space.md },
  footer: { alignItems: "center", gap: space.sm, paddingTop: space.lg },
});
