import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { QueryState, Screen, Text } from "@/ui";
import { useAdminStats } from "./api";
import { BarTable, Meter, StatCard } from "./parts";

function pct(n: number, d: number): string {
  return d ? `${Math.round((n / d) * 1000) / 10}%` : "—";
}

/** 統計 (the website's /app/admin/stats). */
export function AdminStatsScreen() {
  const t = useTranslations("adminStats");
  const query = useAdminStats();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {(s) => (
          <Screen refreshing={refreshing} onRefresh={onRefresh}>
            <Text variant="small" tone="muted">
              {t("description")}
            </Text>
            <StatCard
              label={t("activeMembers")}
              value={String(s.activeMembers)}
              sub={t("allAccounts", { count: s.totalAccounts })}
            />
            <StatCard
              label={t("line.linked")}
              value={pct(s.lineLinked, s.activeMembers)}
              sub={t("line.ofActive", {
                count: s.lineLinked,
                total: s.activeMembers,
              })}
            >
              <Meter
                share={s.activeMembers ? s.lineLinked / s.activeMembers : 0}
              />
            </StatCard>
            <StatCard
              label={t("line.following")}
              value={pct(s.lineFollowing, s.activeMembers)}
              sub={t("line.ofActive", {
                count: s.lineFollowing,
                total: s.activeMembers,
              })}
            >
              <Meter
                share={s.activeMembers ? s.lineFollowing / s.activeMembers : 0}
              />
            </StatCard>
            {s.charts.map((c) => (
              <BarTable key={c.id} chart={c} />
            ))}
          </Screen>
        )}
      </QueryState>
    </>
  );
}
