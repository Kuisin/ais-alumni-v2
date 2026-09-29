import { Check, ChevronDown } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space, Text, TOUCH } from "@/ui";

/** The website's <select>s, as native controls. */

export type Choice = { value: string; label: string };

/** A few short options as toggle chips (single choice). */
export function Chips({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text variant="small" weight="semibold">
        {label}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {choices.map((c) => {
          const on = c.value === value;
          return (
            <Pressable
              key={c.value || "none"}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${label}: ${c.label}`}
              onPress={() => onChange(c.value)}
              hitSlop={4}
              style={({ pressed }) => [
                styles.chip,
                on ? styles.chipOn : null,
                pressed && !on ? styles.chipPressed : null,
              ]}
            >
              <Text
                variant="small"
                weight={on ? "semibold" : "medium"}
                style={{ color: on ? colors.white : colors.slate700 }}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A radio list (long options such as 学年). */
export function ChoiceList({
  choices,
  value,
  onChange,
  label,
}: {
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  /** group name for screen readers */
  label: string;
}) {
  return (
    <View
      style={styles.list}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {choices.map((c, i) => {
        const on = c.value === value;
        return (
          <Pressable
            key={c.value || "none"}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={c.label}
            onPress={() => onChange(c.value)}
            style={({ pressed }) => [
              styles.option,
              i > 0 ? styles.optionBorder : null,
              pressed ? styles.optionPressed : null,
            ]}
          >
            <Text
              style={styles.optionText}
              weight={on ? "semibold" : "regular"}
              tone={on ? "brand" : "default"}
            >
              {c.label}
            </Text>
            {on ? (
              <Check size={20} color={colors.brand700} aria-hidden />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A labelled field showing the chosen option; opens a list on press. */
export function SelectField({
  label,
  value,
  onPress,
  expanded,
  trailing,
}: {
  label: string;
  /** the chosen option's label */
  value: string;
  onPress: () => void;
  /** set when the list opens in place (not in a sheet) */
  expanded?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text variant="small" weight="semibold">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityState={expanded === undefined ? undefined : { expanded }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.select,
          pressed ? styles.optionPressed : null,
        ]}
      >
        <Text style={styles.optionText} numberOfLines={1}>
          {value}
        </Text>
        {trailing}
        <ChevronDown
          size={18}
          color={colors.slate500}
          aria-hidden
          style={expanded ? styles.flip : undefined}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: TOUCH - 8,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  chipPressed: { backgroundColor: colors.slate100 },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  option: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  optionBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  optionPressed: { backgroundColor: colors.slate100 },
  optionText: { flex: 1 },
  select: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  flip: { transform: [{ rotate: "180deg" }] },
});
