import type { AdminDetailRow } from "@contract/admin";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Card, colors, radius, space, Text } from "@/ui";

export type SignalTone = "green" | "blue" | "amber" | "red" | "dim";

const TONES: Record<SignalTone, { bg: string; fg: string; border: string }> = {
  green: { bg: colors.green50, fg: colors.green700, border: colors.green100 },
  blue: { bg: colors.brand50, fg: colors.brand800, border: colors.brand100 },
  amber: { bg: colors.amber50, fg: colors.amber900, border: colors.amber100 },
  red: { bg: colors.red50, fg: colors.red700, border: colors.red100 },
  dim: { bg: "transparent", fg: colors.slate400, border: colors.slate200 },
};

/**
 * Small review signal chip (the website's Signal): positive signals in
 * color, empty or negative ones dimmed so the eye lands on what matters.
 */
export function Signal({
  tone,
  icon: Icon,
  label,
}: {
  tone: SignalTone;
  icon?: LucideIcon;
  label: string;
}) {
  const t = TONES[tone];
  return (
    <View
      style={[styles.signal, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      {Icon ? <Icon size={14} color={t.fg} aria-hidden /> : null}
      <Text variant="caption" weight="medium" style={{ color: t.fg }}>
        {label}
      </Text>
    </View>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

/** A titled card on the application screen (the website's Section). */
export function DetailCard({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** a highlighted box (invitation, duplicate warning) */
  tone?: "green" | "amber" | "slate";
  children: ReactNode;
}) {
  const box =
    tone === "green"
      ? { backgroundColor: colors.green50, borderColor: colors.green100 }
      : tone === "amber"
        ? { backgroundColor: colors.amber50, borderColor: colors.amber400 }
        : tone === "slate"
          ? { backgroundColor: colors.slate50 }
          : null;
  return (
    <Card style={{ ...styles.card, ...box }}>
      <View style={styles.cardTitle}>
        {Icon ? <Icon size={20} color={colors.brand700} aria-hidden /> : null}
        <Text variant="subheading" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </Card>
  );
}

/** Label / value lines (the website's <dl>); empty values are left out. */
export function Rows({
  rows,
}: {
  rows: (AdminDetailRow | { label: string; value: ReactNode })[];
}) {
  return (
    <View style={styles.rows}>
      {rows.map((r) =>
        r.value === null || r.value === undefined || r.value === "" ? null : (
          <View key={r.label} style={styles.row}>
            <Text variant="small" tone="muted">
              {r.label}
            </Text>
            {typeof r.value === "string" ? (
              <Text variant="small" selectable>
                {r.value}
              </Text>
            ) : (
              r.value
            )}
          </View>
        ),
      )}
    </View>
  );
}

/** Grey inset box (a roster row, one child in the answers). */
export function Inset({ children }: { children: ReactNode }) {
  return <View style={styles.inset}>{children}</View>;
}

/** "12 KB" / "1.4 MB" */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  signal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: { gap: space.md },
  cardTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rows: { gap: space.sm },
  row: { gap: 2 },
  inset: {
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
});
