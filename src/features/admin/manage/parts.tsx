import type { BarChart } from "@contract/admin-manage";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Card, colors, radius, space, Text } from "@/ui";

/** Pieces the committee screens share (the website's BarTable, stat cards). */

/**
 * The website's BarTable: label, count and share per row with a bar; one
 * block per row, so it fits a phone. The bars are decorative.
 */
export function BarTable({ chart }: { chart: BarChart }) {
  const t = useTranslations("adminStats");
  const sum = chart.total ?? chart.rows.reduce((a, r) => a + r.value, 0);
  const max = Math.max(1, ...chart.rows.map((r) => r.value));
  return (
    <Card style={styles.card}>
      <Text variant="subheading" accessibilityRole="header">
        {chart.title}
      </Text>
      {chart.note ? (
        <Text variant="small" tone="muted">
          {chart.note}
        </Text>
      ) : null}
      {chart.rows.length === 0 || sum === 0 ? (
        <View style={styles.empty}>
          <Text variant="small" tone="subtle" center>
            {t("noData")}
          </Text>
        </View>
      ) : (
        <View>
          {chart.rows.map((r, i) => {
            const share = sum ? `${Math.round((r.value / sum) * 100)}%` : "—";
            return (
              <View
                key={r.key}
                style={[styles.row, i > 0 ? styles.rowBorder : null]}
                accessible
                accessibilityLabel={`${r.label}: ${t("count")} ${r.value}, ${t("share")} ${share}`}
              >
                <View style={styles.rowText}>
                  <Text variant="small" style={styles.label}>
                    {r.label}
                  </Text>
                  <Text variant="small" style={styles.num}>
                    {r.value}
                  </Text>
                  <Text variant="small" tone="muted" style={styles.num}>
                    {share}
                  </Text>
                </View>
                <View style={styles.track}>
                  <View
                    style={[styles.bar, { width: `${(r.value / max) * 100}%` }]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

/** A big number with a caption (the website's summary cards). */
export function StatCard({
  label,
  value,
  sub,
  icon,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card style={styles.stat}>
      {icon}
      <View style={styles.statText}>
        <Text variant="small" tone="muted">
          {label}
        </Text>
        <Text variant="title" style={styles.tabular}>
          {value}
        </Text>
        {sub ? (
          <Text variant="caption" tone="subtle">
            {sub}
          </Text>
        ) : null}
        {children}
      </View>
    </Card>
  );
}

/** A thin progress bar (decorative). */
export function Meter({
  share,
  color = colors.line,
}: {
  /** 0…1 */
  share: number;
  color?: string;
}) {
  return (
    <View style={styles.meter} aria-hidden>
      <View
        style={[
          styles.meterFill,
          {
            width: `${Math.min(100, Math.max(0, share * 100))}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

/** Label / value pairs (the website's <dl>). */
export function Facts({
  rows,
}: {
  rows: { label: string; value: ReactNode }[];
}) {
  return (
    <View style={styles.facts}>
      {rows.map((r) => (
        <View key={r.label} style={styles.fact}>
          <Text variant="small" tone="subtle" style={styles.factLabel}>
            {r.label}
          </Text>
          <View style={styles.factValue}>
            {typeof r.value === "string" ? (
              <Text variant="small" selectable>
                {r.value}
              </Text>
            ) : (
              r.value
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  empty: {
    paddingVertical: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.slate300,
  },
  row: { paddingVertical: space.sm, gap: space.xs },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate100,
  },
  rowText: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  label: { flex: 1 },
  num: { minWidth: 40, textAlign: "right", fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.slate100 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.brand700 },
  stat: { flexDirection: "row", alignItems: "center", gap: space.lg },
  statText: { flex: 1, gap: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
  meter: {
    marginTop: space.sm,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.slate100,
    overflow: "hidden",
  },
  meterFill: { height: 8, borderRadius: 4 },
  facts: { gap: space.xs },
  fact: { flexDirection: "row", gap: space.md, flexWrap: "wrap" },
  factLabel: { minWidth: 96 },
  factValue: { flex: 1, minWidth: 160 },
});
