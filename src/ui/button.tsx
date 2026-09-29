import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Text } from "./text";
import { colors, radius, space, TOUCH } from "./theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "line";

const STYLES: Record<
  Variant,
  { bg: string; pressed: string; fg: string; border?: string }
> = {
  primary: { bg: colors.brand700, pressed: colors.brand800, fg: colors.white },
  secondary: {
    bg: colors.white,
    pressed: colors.slate100,
    fg: colors.slate900,
    border: colors.slate300,
  },
  ghost: { bg: "transparent", pressed: colors.brand50, fg: colors.brand700 },
  danger: { bg: colors.red600, pressed: colors.red700, fg: colors.white },
  line: { bg: colors.line, pressed: "#05b04b", fg: colors.white },
};

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
  icon?: (color: string) => ReactNode;
  loading?: boolean;
  /** smaller padding for inline actions */
  compact?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = "primary",
  icon,
  loading = false,
  compact = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const s = STYLES[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(off), busy: loading }}
      disabled={off}
      {...props}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : null,
        {
          backgroundColor: pressed ? s.pressed : s.bg,
          borderColor: s.border ?? "transparent",
          opacity: off && !loading ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={s.fg} />
        ) : icon ? (
          icon(s.fg)
        ) : null}
        <Text
          variant={compact ? "small" : "body"}
          weight="semibold"
          style={{ color: s.fg }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    justifyContent: "center",
  },
  compact: { minHeight: 36, paddingHorizontal: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
});
