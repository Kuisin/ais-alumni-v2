import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radius, space } from "./theme";

/** White box with a hairline border (the website's Card). */
export function Card({
  children,
  onPress,
  style,
  padded = true,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  if (onPress)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          padded ? styles.padded : null,
          pressed ? styles.pressed : null,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  return (
    <View style={[styles.card, padded ? styles.padded : null, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
  padded: { padding: space.lg },
  pressed: { backgroundColor: colors.slate50 },
});
