import type { AdminDonation, AdminDonationTotals } from "@contract/donations";
import { Stack, useRouter } from "expo-router";
import { HandCoins } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { yen } from "@/features/donate/donate-form";
import { formatDateTime } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  ErrorState,
  Loading,
  Screen,
  space,
  Text,
  TOUCH,
} from "@/ui";
import { useAdminDonations } from "./api";

/**
 * 管理モード → 寄付 (admins; app only — Stripe is the ledger): every
 * successful donation, newest first, with this month's / year's / all-time
 * totals. Members are named (their admin page); anyone else is 匿名 — the
 * server never sends a guest's Stripe name or email.
 */
export function AdminDonationsScreen() {
  const t = useTranslations("mobile.admin.donations");
  const query = useAdminDonations();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  const first = query.data?.pages[0];
  const donations = query.data?.pages.flatMap((p) => p.donations) ?? [];

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Text variant="small" tone="muted">
          {t("description")}
        </Text>
        {query.isError && !query.data ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !first ? (
          <Loading inline />
        ) : !first.available ? (
          <Text tone="muted">{t("unavailable")}</Text>
        ) : (
          <>
            {first.totals ? <Totals totals={first.totals} /> : null}
            {donations.length === 0 ? (
              <EmptyState
                icon={
                  <HandCoins size={28} color={colors.slate400} aria-hidden />
                }
                title={t("empty")}
              />
            ) : (
              <Card padded={false}>
                {donations.map((d, i) => (
                  <DonationRow key={d.id} donation={d} first={i === 0} />
                ))}
              </Card>
            )}
            {query.hasNextPage ? (
              <Button
                variant="secondary"
                label={t("more")}
                loading={query.isFetchingNextPage}
                onPress={() => query.fetchNextPage()}
              />
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}

function Totals({ totals }: { totals: AdminDonationTotals }) {
  const t = useTranslations("mobile.admin.donations");
  const locale = useLocale() === "en" ? "en" : "ja";
  const money = (n: number | null) =>
    n === null ? t("notCounted") : yen(n, locale);
  const items = [
    { key: "month", label: t("month"), value: money(totals.month) },
    { key: "year", label: t("year"), value: money(totals.year) },
    { key: "allTime", label: t("allTime"), value: money(totals.allTime) },
    {
      key: "activeMonthly",
      label: t("activeMonthly"),
      value:
        totals.activeMonthly === null
          ? t("notCounted")
          : t("activeMonthlyCount", { count: totals.activeMonthly }),
    },
  ];
  return (
    <View style={styles.totalsWrap}>
      <View style={styles.totals}>
        {items.map((i) => (
          <Card key={i.key} style={styles.total}>
            <View accessible accessibilityLabel={`${i.label}: ${i.value}`}>
              <Text variant="small" tone="muted">
                {i.label}
              </Text>
              <Text variant="subheading">{i.value}</Text>
            </View>
          </Card>
        ))}
      </View>
      <Text variant="caption" tone="subtle">
        {t("totalsNote")}
      </Text>
    </View>
  );
}

function DonationRow({
  donation: d,
  first,
}: {
  donation: AdminDonation;
  first: boolean;
}) {
  const t = useTranslations("mobile.admin.donations");
  const th = useTranslations("mobile.donate.history");
  const locale = useLocale() === "en" ? "en" : "ja";
  const router = useRouter();
  const date = formatDateTime(d.date, locale);
  const interval = th(d.interval);
  const amount = yen(d.amount, locale);
  const donor = d.donor?.name ?? t("anonymous");
  const refund =
    d.refund === "full"
      ? th("refunded")
      : d.refund === "partial"
        ? th("partlyRefunded", { amount: yen(d.refundedAmount, locale) })
        : null;
  const member = d.donor;
  return (
    <View style={[styles.row, first ? null : styles.rowBorder]}>
      <View
        style={styles.rowText}
        accessible
        accessibilityLabel={[
          t("rowLabel", { date, donor, interval, amount }),
          refund,
        ]
          .filter(Boolean)
          .join(locale === "en" ? ", " : "、")}
      >
        <Text variant="small" tone="muted">
          {date}
        </Text>
        <View style={styles.rowLine}>
          <Text
            weight="semibold"
            style={d.refund === "full" ? styles.struck : undefined}
          >
            {amount}
          </Text>
          <Badge
            label={interval}
            tone={d.interval === "month" ? "brand" : "slate"}
          />
          {refund ? <Badge label={refund} tone="amber" /> : null}
        </View>
      </View>
      {member ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={member.name}
          onPress={() =>
            router.push({
              pathname: "/admin/members/[id]",
              params: { id: member.id },
            })
          }
          style={styles.donor}
          hitSlop={4}
        >
          <Text variant="small" tone="brand" numberOfLines={1}>
            {member.name}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.donor}>
          <Text variant="small" tone="subtle" numberOfLines={1}>
            {t("anonymous")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  totalsWrap: { gap: space.xs },
  totals: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  total: { flexGrow: 1, flexBasis: 140 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowText: { flex: 1, gap: 2 },
  rowLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  struck: { textDecorationLine: "line-through" },
  donor: {
    minHeight: TOUCH,
    maxWidth: "45%",
    justifyContent: "center",
    alignItems: "flex-end",
  },
});
