import type { NotificationOpens } from "@contract/admin-notify";
import type { Locale } from "@contract/core";
import { BellRing, ChevronDown } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { TIME_ZONE } from "@/lib/format";
import { Card, colors, radius, space, Text, TOUCH } from "@/ui";

/**
 * Read receipts for admin pages (the website's read-receipts.tsx and
 * notification-opens-card.tsx): a meter and member lists that fold after
 * 20 rows, so long lists stay short on phones.
 */

/** Whole-number share of read / total (0 when there is no one to read). */
export function readPercent(read: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((read / total) * 100)) : 0;
}

/** Compact date + time for receipts: 2026/09/27 14:05 · Sep 27, 2026 14:05 */
export function receiptTime(iso: string, locale: Locale): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: locale === "ja" ? "2-digit" : "short",
    day: locale === "ja" ? "2-digit" : "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${date} ${time}`;
}

/** 「既読 N / M」 with its percentage and a slim bar (`lg`: headline). */
export function ReadMeter({
  read,
  total,
  label,
  percentLabel,
  size = "sm",
}: {
  read: number;
  total: number;
  label: string;
  percentLabel: string;
  size?: "sm" | "lg";
}) {
  const pct = readPercent(read, total);
  const lg = size === "lg";
  return (
    <View style={{ gap: lg ? space.sm : space.xs }}>
      <View
        style={styles.meterText}
        accessible
        accessibilityLabel={`${label} ${percentLabel}`}
      >
        <Text
          variant={lg ? "heading" : "caption"}
          weight={lg ? "bold" : "medium"}
        >
          {label}
        </Text>
        <Text variant={lg ? "body" : "caption"} tone="subtle">
          {percentLabel}
        </Text>
      </View>
      <View style={[styles.track, { height: lg ? 12 : 6 }]}>
        <View
          style={[
            styles.bar,
            {
              width: `${pct}%`,
              backgroundColor: pct === 100 ? colors.green600 : colors.brand700,
            },
          ]}
        />
      </View>
    </View>
  );
}

export type ReceiptItem = { key: string; name: string; time?: string | null };

/** Members, the rest after `limit` behind 「すべて表示」. */
export function ReceiptList({
  items,
  moreLabel,
  empty,
  limit = 20,
}: {
  items: ReceiptItem[];
  moreLabel: string;
  empty: string;
  limit?: number;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0)
    return (
      <Text variant="small" tone="subtle" style={styles.empty}>
        {empty}
      </Text>
    );
  const rest = items.length - limit;
  const shown = open || rest <= 0 ? items : items.slice(0, limit);
  return (
    <View>
      {shown.map((i, n) => (
        <View key={i.key} style={[styles.row, n > 0 ? styles.rowBorder : null]}>
          <Text variant="small" style={styles.name}>
            {i.name}
          </Text>
          {i.time ? (
            <Text variant="caption" tone="subtle">
              {i.time}
            </Text>
          ) : null}
        </View>
      ))}
      {rest > 0 && !open ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={styles.more}
        >
          <ChevronDown size={16} color={colors.brand700} aria-hidden />
          <Text variant="small" tone="brand" weight="medium">
            {moreLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A card with an icon heading (the website's admin sections). */
export function IconCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.heading}>
        {icon}
        <Text variant="subheading" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </Card>
  );
}

/**
 * 「通知の開封」: who was notified (LINE / email / app) about this item and
 * who opened it. Hidden until a notification was sent.
 */
export function NotificationOpensCard({ opens }: { opens: NotificationOpens }) {
  const t = useTranslations("notifications.receipts");
  const locale = useLocale() as Locale;
  if (!opens) return null;
  const opened = opens.opened.length;
  const total = opened + opens.unopened.length;
  if (total === 0) return null;
  const name = (r: NonNullable<NotificationOpens>["opened"][number]) =>
    `${r.name} · ${r.channels.map((c) => t(`channel.${c}`)).join("/")}`;
  const more = (n: number) => t("showAll", { count: n - 20 });
  return (
    <IconCard
      icon={<BellRing size={20} color={colors.brand700} aria-hidden />}
      title={t("title")}
    >
      <ReadMeter
        size="lg"
        read={opened}
        total={total}
        label={t("openedOf", { opened, total })}
        percentLabel={t("percent", { percent: readPercent(opened, total) })}
      />
      <Text variant="caption" tone="subtle">
        {t("hint")}
      </Text>
      <Text variant="small" weight="semibold" style={styles.sub}>
        {t("opened")}
      </Text>
      <ReceiptList
        empty={t("noneOpened")}
        moreLabel={more(opened)}
        items={opens.opened.map((r) => ({
          key: r.userId,
          name: name(r),
          time: r.at ? receiptTime(r.at, locale) : null,
        }))}
      />
      <Text variant="small" weight="semibold" style={styles.sub}>
        {t("unopened")}
      </Text>
      <ReceiptList
        empty={t("allOpened")}
        moreLabel={more(opens.unopened.length)}
        items={opens.unopened.map((r) => ({ key: r.userId, name: name(r) }))}
      />
    </IconCard>
  );
}

const styles = StyleSheet.create({
  meterText: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: space.sm,
  },
  track: {
    width: "100%",
    overflow: "hidden",
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
  },
  bar: { height: "100%", borderRadius: radius.full },
  empty: { paddingVertical: space.sm },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: space.md,
    paddingVertical: space.sm,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate100,
  },
  name: { flexShrink: 1 },
  more: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  card: { gap: space.md },
  heading: { flexDirection: "row", alignItems: "center", gap: space.sm },
  sub: { marginTop: space.sm },
});
