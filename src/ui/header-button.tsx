import type { LucideIcon } from "lucide-react-native";
import { Plus } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "./text";
import { colors, space, TOUCH } from "./theme";

/**
 * A labelled action at the right of a tab's header — 「作成」 on ニュース and
 * イベント, 「新しいトーク」 on チャット — so every "create" looks the same.
 */
export function HeaderButton({
  label,
  onPress,
  icon: Icon = Plus,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <Icon size={20} color={colors.brand700} aria-hidden />
      <Text variant="small" weight="semibold" tone="brand">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: TOUCH,
    paddingHorizontal: space.lg,
  },
  pressed: { opacity: 0.6 },
});
