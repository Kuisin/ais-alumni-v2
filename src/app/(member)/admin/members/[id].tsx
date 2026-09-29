import type { AdminMemberDetail } from "@contract/admin-members";
import { Stack, useLocalSearchParams } from "expo-router";
import { IdCard } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { AccountCard } from "@/features/admin/members/account-card";
import { useAdminMember } from "@/features/admin/members/api";
import { AuditCard } from "@/features/admin/members/audit-card";
import { StateBadge } from "@/features/admin/members/badges";
import { FamilyCard } from "@/features/admin/members/family-card";
import { HistoryCard } from "@/features/admin/members/history-card";
import { MergeCard } from "@/features/admin/members/merge-card";
import { PositionsCard } from "@/features/admin/members/positions-card";
import { ProfileCard } from "@/features/admin/members/profile-card";
import { RolesCard } from "@/features/admin/members/roles-card";
import { AdminCard, Facts, Notice } from "@/features/admin/parts";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Badge, QueryState, Screen, space, Text } from "@/ui";

/**
 * 会員詳細 (the website's /app/admin/members/[id]): overview, profile,
 * 区分, 学歴・職歴, 家族, 役職, account state and admin rights, merging a duplicate and
 * the latest audit entries — one scrolling page of cards on a phone.
 */
export default function AdminMemberScreen() {
  const { id, merged } = useLocalSearchParams<{
    id: string;
    merged?: string;
  }>();
  const t = useTranslations("adminMembers");
  const member = useAdminMember(id);
  const [refreshing, setRefreshing] = useState(false);

  return (
    <>
      <Stack.Screen options={{ title: t("detail.title") }} />
      <QueryState query={member}>
        {(m) => (
          <Screen
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await member.refetch().catch(() => {});
              setRefreshing(false);
            }}
          >
            <Header m={m} />
            {merged ? (
              <Notice tone="success">{t("detail.merged")}</Notice>
            ) : null}
            <Overview m={m} />
            <ProfileCard m={m} />
            <RolesCard m={m} />
            <HistoryCard m={m} />
            <FamilyCard m={m} />
            <PositionsCard m={m} />
            <AccountCard m={m} />
            <MergeCard m={m} />
            <AuditCard m={m} />
          </Screen>
        )}
      </QueryState>
    </>
  );
}

function Header({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers");
  return (
    <View style={styles.header}>
      <View style={styles.title}>
        <Text variant="heading" selectable style={styles.flex}>
          {m.name ?? t("noName")}
        </Text>
        {m.isAdmin ? <Badge tone="brand" label={t("badge.admin")} /> : null}
      </View>
      {m.otherName ? <Text tone="muted">{m.otherName}</Text> : null}
      {m.email ? (
        <Text variant="small" tone="muted" selectable>
          {m.email}
        </Text>
      ) : null}
      <View style={styles.badges}>
        <StateBadge state={m.state} label={m.stateLabel} />
      </View>
    </View>
  );
}

function Overview({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers");
  const { locale } = useAuth();
  return (
    <AdminCard title={t("detail.overview")} icon={IdCard}>
      <Facts
        rows={[
          [t("columns.state"), m.stateLabel],
          [t("columns.roles"), m.roleLabels.join(", ")],
          [
            t("columns.email"),
            m.email
              ? `${m.email}${m.emailVerified ? "" : ` (${t("detail.unverified")})`}`
              : null,
          ],
          [
            t("columns.line"),
            `${t(`line.${m.line.status}`)}${m.line.displayName ? ` · ${m.line.displayName}` : ""}`,
          ],
          [t("detail.providers"), m.providers.join(", ")],
          [t("detail.notifyVia"), m.notifyVia],
          [t("columns.created"), formatDateTime(m.createdAt, locale)],
          ...(m.deactivatedAt
            ? ([
                [
                  t("detail.deactivatedAt"),
                  formatDateTime(m.deactivatedAt, locale),
                ],
              ] as [string, string][])
            : []),
          ["ID", m.id],
        ]}
      />
    </AdminCard>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  title: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
