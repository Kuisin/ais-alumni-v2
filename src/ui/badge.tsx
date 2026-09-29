import { StyleSheet, View } from "react-native";
import { Text } from "./text";
import { colors, radius, space } from "./theme";

type Tone = "brand" | "amber" | "slate" | "red" | "green";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: colors.brand100, fg: colors.brand800 },
  amber: { bg: colors.amber100, fg: colors.amber900 },
  slate: { bg: colors.slate200, fg: colors.slate700 },
  red: { bg: colors.red100, fg: colors.red700 },
  green: { bg: colors.green100, fg: colors.green700 },
};

export function Badge({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: Tone;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text variant="caption" weight="semibold" style={{ color: t.fg }}>
        {label}
      </Text>
    </View>
  );
}

/** Small red count (unread). */
export function CountDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.dot}>
      <Text variant="caption" weight="bold" tone="inverse">
        {count > 99 ? "99+" : String(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  dot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.red600,
    alignItems: "center",
    justifyContent: "center",
  },
});
