import { Check } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, colors, radius, space, Text, TOUCH } from "@/ui";

/**
 * Form building blocks of the website's editors (NewsForm / EventForm):
 * card-wrapped sections with an icon, and the checkbox / radio "choice
 * cards".
 */

export function FormSection({
  icon,
  title,
  description,
  children,
}: {
  icon: (color: string) => ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>{icon(colors.brand700)}</View>
        <Text
          variant="subheading"
          accessibilityRole="header"
          style={styles.flex}
        >
          {title}
        </Text>
      </View>
      {description ? (
        <Text variant="small" tone="subtle">
          {description}
        </Text>
      ) : null}
      {children}
    </Card>
  );
}

/** A checkbox or radio button with its label (and hint) as one target. */
export function ChoiceCard({
  label,
  hint,
  checked,
  onChange,
  radio = false,
  disabled = false,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  radio?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={radio ? "radio" : "checkbox"}
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      disabled={disabled}
      onPress={() => onChange(radio ? true : !checked)}
      style={({ pressed }) => [
        styles.choice,
        checked ? styles.choiceOn : null,
        pressed ? styles.choicePressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View
        style={[
          radio ? styles.radio : styles.box,
          checked ? styles.markOn : null,
        ]}
      >
        {checked ? (
          radio ? (
            <View style={styles.dot} />
          ) : (
            <Check size={14} color={colors.white} strokeWidth={3} aria-hidden />
          )
        ) : null}
      </View>
      <View style={styles.flex}>
        <Text variant="small" weight="medium">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" tone="subtle">
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A small toggle button in a row of filters (aria-pressed). */
export function ToggleChip({
  label,
  pressed,
  onPress,
  disabled,
}: {
  label: string;
  pressed: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: pressed, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed: down }) => [
        styles.chip,
        pressed ? styles.chipOn : null,
        down ? styles.choicePressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text
        variant="small"
        weight={pressed ? "semibold" : "regular"}
        style={pressed ? styles.chipOnText : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A form-level message (error / success / info), as the website's Alert. */
export function Notice({
  tone,
  children,
}: {
  tone: "error" | "success" | "info" | "warning";
  children: string;
}) {
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, NOTICE[tone]]}
    >
      <Text variant="small" style={{ color: NOTICE_TEXT[tone] }}>
        {children}
      </Text>
    </View>
  );
}

const NOTICE = {
  error: { backgroundColor: colors.red50, borderColor: colors.red100 },
  success: { backgroundColor: colors.green50, borderColor: colors.green100 },
  info: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  warning: { backgroundColor: colors.amber50, borderColor: colors.amber100 },
} as const;
const NOTICE_TEXT = {
  error: colors.red700,
  success: colors.green700,
  info: colors.brand900,
  warning: colors.amber900,
} as const;

/** Error text under a group of fields. */
export function FieldError({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <Text variant="small" tone="danger" accessibilityRole="alert">
      {children}
    </Text>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.md },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center",
  },
  choice: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  choiceOn: { borderColor: colors.brand300, backgroundColor: colors.brand50 },
  choicePressed: { backgroundColor: colors.slate100 },
  disabled: { opacity: 0.55 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.slate400,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.slate400,
    alignItems: "center",
    justifyContent: "center",
  },
  markOn: { borderColor: colors.brand700, backgroundColor: colors.brand700 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  chip: {
    minHeight: TOUCH,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  chipOn: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  chipOnText: { color: colors.brand800 },
  notice: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
});
