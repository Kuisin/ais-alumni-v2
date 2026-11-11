import type { MyDonation, MyMonthlyDonation } from "@contract/donations";
import { Stack } from "expo-router";
import { ExternalLink, HandCoins, Receipt } from "lucide-react-native";
import { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { formatDate } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  QueryState,
  Screen,
  Section,
  space,
  Text,
  TOUCH,
} from "@/ui";
import { useMyDonations } from "./api";
import { yen } from "./donate-form";

const open = (url: string) => void Linking.openURL(url).catch(() => {});

/**
 * 寄付の履歴 (マイページ): the member's own donations — the ones made while
 * signed in (their Stripe Customer) — with totals, a running monthly
 * donation and Stripe's receipts. Showing one's history is fine in the
 * iOS / Android app; giving happens in the browser (src/app/donate.tsx).
 */
export function DonationHistoryScreen() {
  const t = useTranslations("mobile.donate.history");
  const td = useTranslations("mobile.donate");
  const locale = useLocale() === "en" ? "en" : "ja";
  const query = useMyDonations();
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
        {(data) => (
          <Screen refreshing={refreshing} onRefresh={onRefresh}>
            {!data.available ? (
              <Text tone="muted">{t("unavailable")}</Text>
            ) : data.donations.length === 0 && data.monthly.length === 0 ? (
              <EmptyState
                icon={
                  <HandCoins size={28} color={colors.slate400} aria-hidden />
                }
                title={t("empty")}
                hint={t("emptyBody")}
              />
            ) : (
              <>
                <Text variant="small" tone="muted">
                  {t("intro")}
                </Text>
                <Card style={styles.total}>
                  <Text variant="small" tone="muted">
                    {t("total")}
                  </Text>
                  <Text variant="title">{yen(data.total, locale)}</Text>
                  <Text variant="small" tone="subtle">
                    {t("count", { count: data.donations.length })}
                  </Text>
                </Card>
                {data.monthly.length > 0 ? (
                  <Section title={t("monthlyTitle")}>
                    {data.monthly.map((m, i) => (
                      <MonthlyCard
                        // biome-ignore lint/suspicious/noArrayIndexKey: no id is sent
                        key={i}
                        monthly={m}
                      />
                    ))}
                    {data.portalUrl && Platform.OS === "web" ? (
                      <Button
                        variant="secondary"
                        label={td("manage")}
                        icon={(c) => (
                          <ExternalLink size={18} color={c} aria-hidden />
                        )}
                        onPress={() => open(data.portalUrl as string)}
                      />
                    ) : null}
                  </Section>
                ) : null}
                {data.donations.length > 0 ? (
                  <Section title={t("listTitle")}>
                    <Card padded={false}>
                      {data.donations.map((d, i) => (
                        <DonationRow key={d.id} donation={d} first={i === 0} />
                      ))}
                    </Card>
                  </Section>
                ) : null}
              </>
            )}
          </Screen>
        )}
      </QueryState>
    </>
  );
}

function MonthlyCard({ monthly: m }: { monthly: MyMonthlyDonation }) {
  const t = useTranslations("mobile.donate.history");
  const locale = useLocale() === "en" ? "en" : "ja";
  return (
    <Card style={styles.monthly}>
      <Text variant="subheading">
        {t("monthlyAmount", { amount: yen(m.amount, locale) })}
      </Text>
      {m.nextDate ? (
        <Text variant="small" tone="muted">
          {t("next", { date: formatDate(m.nextDate, locale) })}
        </Text>
      ) : m.endsAt ? (
        <Text variant="small" tone="muted">
          {t("endsAt", { date: formatDate(m.endsAt, locale) })}
        </Text>
      ) : null}
    </Card>
  );
}

function DonationRow({
  donation: d,
  first,
}: {
  donation: MyDonation;
  first: boolean;
}) {
  const t = useTranslations("mobile.donate.history");
  const locale = useLocale() === "en" ? "en" : "ja";
  const date = formatDate(d.date, locale);
  const interval = t(d.interval);
  const amount = yen(d.amount, locale);
  const refund =
    d.refund === "full"
      ? t("refunded")
      : d.refund === "partial"
        ? t("partlyRefunded", { amount: yen(d.refundedAmount, locale) })
        : null;
  return (
    <View style={[styles.row, first ? null : styles.rowBorder]}>
      <View
        style={styles.rowText}
        accessible
        accessibilityLabel={[t("rowLabel", { date, interval, amount }), refund]
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
      {d.receiptUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("receiptLabel", { date })}
          onPress={() => open(d.receiptUrl as string)}
          style={styles.receipt}
          hitSlop={4}
        >
          <Receipt size={18} color={colors.brand700} aria-hidden />
          <Text variant="small" tone="brand" weight="semibold">
            {t("receipt")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  total: { gap: space.xs },
  monthly: { gap: space.xs },
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
  receipt: {
    minHeight: TOUCH,
    minWidth: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
});
