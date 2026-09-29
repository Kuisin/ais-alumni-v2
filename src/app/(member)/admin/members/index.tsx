import type { AdminMemberRow } from "@contract/admin-members";
import { Stack, useRouter } from "expo-router";
import {
  ChevronDown,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react-native";
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
  type MemberFilters,
  NO_FILTERS,
  useAdminMembers,
} from "@/features/admin/members/api";
import { LineDot, StateBadge } from "@/features/admin/members/badges";
import { Picker } from "@/features/admin/parts";
import { Chips } from "@/features/people/choices";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  ErrorState,
  Loading,
  ScreenView,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";

/**
 * 会員 (the website's /app/admin/members): search by name, email or ID,
 * filter by state, 区分, LINE and admins; 25 at a time, newest first.
 * The website's table is a list of cards here.
 */
export default function AdminMembersScreen() {
  const t = useTranslations("adminMembers");
  const tc = useTranslations("common");
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [filters, setFilters] = useState<MemberFilters>(NO_FILTERS);
  const [showMore, setShowMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const query = useAdminMembers(filters);
  const pages = query.data?.pages ?? [];
  const first = pages[0];
  const items = pages.flatMap((p) => p.items);
  const secondary = [
    filters.state,
    filters.role,
    filters.line,
    filters.admin,
  ].filter(Boolean).length;
  const filtered = Boolean(filters.q) || secondary > 0;

  const set = (patch: Partial<MemberFilters>) =>
    setFilters((f) => ({ ...f, ...patch }));
  const any = { value: "", label: t("filters.any") };

  const header = (
    <View style={styles.header}>
      <Text variant="small" tone="muted">
        {t("description")}
      </Text>
      <Card style={styles.filters}>
        <TextField
          label={t("filters.search")}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("filters.searchPlaceholder")}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => set({ q: draft.trim() })}
        />
        <View style={styles.row}>
          <Button
            label={tc("search")}
            compact
            icon={(c) => <Search size={16} color={c} aria-hidden />}
            onPress={() => set({ q: draft.trim() })}
          />
          {filtered ? (
            <Button
              label={tc("clear")}
              variant="ghost"
              compact
              onPress={() => {
                setDraft("");
                setFilters(NO_FILTERS);
              }}
            />
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showMore }}
          onPress={() => setShowMore(!showMore)}
          style={styles.more}
        >
          <SlidersHorizontal size={16} color={colors.brand700} aria-hidden />
          <Text variant="small" tone="brand" weight="medium">
            {t("filters.more")}
          </Text>
          {secondary > 0 ? (
            <Badge
              tone="brand"
              label={t("filters.activeCount", { count: secondary })}
            />
          ) : null}
          <ChevronDown
            size={16}
            color={colors.brand700}
            aria-hidden
            style={showMore ? styles.flip : undefined}
          />
        </Pressable>
        {showMore && first ? (
          <View style={styles.more2}>
            <Picker
              label={t("filters.state")}
              choices={[any, ...first.filters.states]}
              value={filters.state}
              onChange={(state) => set({ state })}
            />
            <Picker
              label={t("filters.role")}
              choices={[any, ...first.filters.roles]}
              value={filters.role}
              onChange={(role) => set({ role })}
            />
            <Picker
              label={t("filters.line")}
              choices={[
                any,
                { value: "linked", label: t("filters.lineLinked") },
                { value: "following", label: t("filters.lineFollowing") },
                { value: "unlinked", label: t("filters.lineUnlinked") },
              ]}
              value={filters.line}
              onChange={(line) => set({ line })}
            />
            <Chips
              label={t("badge.admin")}
              choices={[
                { value: "", label: t("filters.any") },
                { value: "1", label: t("filters.adminOnly") },
              ]}
              value={filters.admin ? "1" : ""}
              onChange={(v) => set({ admin: v === "1" })}
            />
          </View>
        ) : null}
      </Card>
      {first ? (
        <Text variant="small" tone="muted" accessibilityLiveRegion="polite">
          {t("resultCount", { count: first.total })}
        </Text>
      ) : null}
    </View>
  );

  return (
    <ScreenView>
      <Stack.Screen options={{ title: t("title") }} />
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <MemberRow
            m={item}
            onPress={() =>
              router.push({
                pathname: "/admin/members/[id]",
                params: { id: item.id },
              })
            }
          />
        )}
        ListEmptyComponent={
          query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : query.isPending ? (
            <Loading inline />
          ) : (
            <EmptyState
              icon={<Users size={32} color={colors.slate400} aria-hidden />}
              title={t("empty")}
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand700} />
          ) : query.hasNextPage ? (
            <Button
              label={t("nextPage")}
              variant="secondary"
              onPress={() => query.fetchNextPage()}
            />
          ) : null
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage)
            void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await query.refetch().catch(() => {});
              setRefreshing(false);
            }}
            tintColor={colors.brand700}
            colors={[colors.brand700]}
          />
        }
      />
    </ScreenView>
  );
}

function MemberRow({ m, onPress }: { m: AdminMemberRow; onPress: () => void }) {
  const t = useTranslations("adminMembers");
  const { locale } = useAuth();
  const name = m.name ?? t("noName");
  return (
    <Card onPress={onPress} accessibilityLabel={name} style={styles.card}>
      <View style={styles.titleRow}>
        <Text weight="semibold" style={styles.flex} numberOfLines={2}>
          {name}
        </Text>
        {m.isAdmin ? <Badge tone="brand" label={t("badge.admin")} /> : null}
      </View>
      {m.otherName ? (
        <Text variant="small" tone="muted">
          {m.otherName}
        </Text>
      ) : null}
      <Text variant="small" tone="muted" numberOfLines={1}>
        {m.email ?? "—"}
      </Text>
      <View style={styles.badges}>
        <StateBadge state={m.state} label={m.stateLabel} />
        {m.roles.map((r) => (
          <Badge key={r} label={r} />
        ))}
      </View>
      <View style={styles.meta}>
        <LineDot status={m.line} />
        <Text variant="caption" tone="subtle">
          {t("columns.line")}: {t(`line.${m.line}`)}
        </Text>
        <Text variant="caption" tone="subtle">
          {t("columns.created")}: {formatDate(m.createdAt, locale)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  header: { gap: space.md },
  filters: { gap: space.md },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  more: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    alignSelf: "flex-start",
  },
  more2: { gap: space.md },
  flip: { transform: [{ rotate: "180deg" }] },
  card: { gap: space.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    marginTop: space.xs,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: space.md,
    rowGap: space.xs,
    marginTop: space.xs,
  },
});
