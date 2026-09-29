import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, space, Text } from "@/ui";

/** The website's <Alert>: a tinted box announcing a result. */
export function Notice({
  tone,
  children,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      {typeof children === "string" ? (
        <Text variant="small" style={{ color: t.fg }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const TONES = {
  success: { bg: colors.green50, border: colors.green100, fg: colors.green700 },
  error: { bg: colors.red50, border: colors.red100, fg: colors.red700 },
  info: { bg: colors.brand50, border: colors.brand100, fg: colors.brand800 },
} as const;

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
  },
});
