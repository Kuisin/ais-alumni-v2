import { Check } from "lucide-react-native";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { colors, space, Text, TOUCH } from "@/ui";

/**
 * Grouped-list rows for 設定 (inside a ListGroup): a single choice with a
 * check mark (radio semantics) and an on/off switch.
 */

export function ChoiceRow({
  title,
  hint,
  selected,
  busy = false,
  disabled = false,
  onPress,
}: {
  title: string;
  hint?: string;
  selected: boolean;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={hint}
      accessibilityState={{ checked: selected, disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.text}>
        <Text
          weight="medium"
          tone={disabled && !selected ? "subtle" : "default"}
        >
          {title}
        </Text>
        {hint ? (
          <Text variant="small" tone="subtle">
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={styles.mark}>
        {busy ? (
          <ActivityIndicator color={colors.brand700} />
        ) : selected ? (
          <Check color={colors.brand700} size={22} aria-hidden />
        ) : null}
      </View>
    </Pressable>
  );
}

export function ToggleRow({
  title,
  hint,
  value,
  disabled = false,
  onChange,
}: {
  title: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text weight="medium">{title}</Text>
        {hint ? (
          <Text variant="small" tone="subtle">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        accessibilityHint={hint}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.brand700, false: colors.slate300 }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.slate300}
        // react-native-web colours the "on" thumb separately (web build only)
        {...(Platform.OS === "web" ? { activeThumbColor: colors.white } : {})}
      />
    </View>
  );
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
  text: { flex: 1, gap: 2 },
  mark: { width: 24, alignItems: "center" },
});
