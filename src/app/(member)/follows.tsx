import type { FollowLists, MemberCard } from "@contract/people";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Search, ShieldOff, Users } from "lucide-react-native";
import { type ReactElement, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useFollows } from "@/features/people/api";
import {
  AcceptedBanner,
  asFollowTab,
  BlockedRow,
  FollowerRow,
  FollowingRow,
  type FollowTab,
  FollowTabs,
  IncomingRow,
  OutgoingRow,
} from "@/features/people/follow-rows";
import { useMe } from "@/lib/auth";
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

type Row = { key: string; node: ReactElement };

/**
 * フォロー (the website's /app/follows): requests to me (accept / decline),
 * my pending requests, followers, following and blocked members.
 * ?tab=incoming|outgoing|followers|following|blocked picks the list.
 */
export default function FollowsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const t = useTranslations("follows");
  const router = useRouter();
  const me = useMe();
  const [tab, setTab] = useState<FollowTab>(asFollowTab(params.tab));
  // The request just accepted (follow-back offer), as ?accepted= on the website.
  const [accepted, setAccepted] = useState<string | null>(null);
  const [paramTab, setParamTab] = useState(params.tab);
  if (params.tab !== paramTab) {
    setParamTab(params.tab);
    setTab(asFollowTab(params.tab));
    setAccepted(null);
  }
  const query = useFollows(accepted);
  const [refreshing, setRefreshing] = useState(false);
  const lists = query.data;

  const choose = (next: FollowTab) => {
    setTab(next);
    setAccepted(null);
  };
  const open = (m: MemberCard) =>
    router.push(
      m.id === me.user.id
        ? "/me"
        : { pathname: "/members/[id]", params: { id: m.id } },
    );
  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  const rows: Row[] = lists ? rowsFor(tab, lists, open, setAccepted) : [];
  const counts = lists
    ? {
        incoming: lists.incoming.length,
        outgoing: lists.outgoing.length,
        followers: lists.followers.length,
        following: lists.following.length,
        blocked: lists.blocked.length,
      }
    : null;

  return (
    <ScreenView>
      <Stack.Screen options={{ title: t("title") }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={({ item }) => item.node}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="small" tone="muted">
              {t("description")}
            </Text>
            <FollowTabs value={tab} onChange={choose} counts={counts} />
            {tab === "incoming" && lists?.accepted ? (
              <AcceptedBanner accepted={lists.accepted} onOpen={open} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !lists ? (
            query.isError ? (
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : (
              <Loading inline />
            )
          ) : (
            <EmptyState
              icon={
                tab === "blocked" ? (
                  <ShieldOff size={32} color={colors.slate400} />
                ) : (
                  <Users size={32} color={colors.slate400} />
                )
              }
              title={t(`empty.${tab}`)}
              action={
                tab === "blocked" ? undefined : (
                  <Button
                    label={t("findInDirectory")}
                    icon={(c) => <Search size={18} color={c} aria-hidden />}
                    onPress={() => router.push("/directory")}
                  />
                )
              }
            />
          )
        }
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

function rowsFor(
  tab: FollowTab,
  lists: FollowLists,
  open: (m: MemberCard) => void,
  onAccepted: (followId: string) => void,
): Row[] {
  switch (tab) {
    case "incoming":
      return lists.incoming.map((f) => ({
        key: f.followId,
        node: <IncomingRow item={f} onOpen={open} onAccepted={onAccepted} />,
      }));
    case "outgoing":
      return lists.outgoing.map((f) => ({
        key: f.followId,
        node: <OutgoingRow item={f} onOpen={open} />,
      }));
    case "followers":
      return lists.followers.map((f) => ({
        key: f.followId,
        node: (
          <FollowerRow
            member={f.member}
            followState={f.followState}
            onOpen={open}
          />
        ),
      }));
    case "following":
      return lists.following.map((f) => ({
        key: f.followId,
        node: <FollowingRow member={f.member} onOpen={open} />,
      }));
    case "blocked":
      return lists.blocked.map((b) => ({
        key: b.blockId,
        node: <BlockedRow member={b.member} />,
      }));
  }
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.md, marginBottom: space.md },
  gap: { height: space.md },
});
