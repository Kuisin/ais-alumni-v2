import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./text";
import { colors, space, TOUCH } from "./theme";

/** A tappable row: leading icon/avatar, title + subtitle, trailing detail. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  chevron = Boolean(onPress),
  destructive = false,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <Text
          variant="body"
          weight="medium"
          tone={destructive ? "danger" : "default"}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" tone="subtle" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? (
        <ChevronRight size={18} color={colors.slate400} aria-hidden />
      ) : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {body}
    </Pressable>
  );
}

/** Rows grouped in a white box with separators. */
export function ListGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  row: {
    minHeight: TOUCH + 8,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.slate100 },
  leading: { alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: space.lg,
  },
});
