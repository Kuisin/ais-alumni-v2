import { createElement } from "react";
import { StyleSheet, View } from "react-native";
import { colors, font, radius, space, Text, TOUCH } from "@/ui";
import type { DateTimeFieldProps } from "./datetime-field";
import { toJstLocal } from "./jst";

export type { DateTimeFieldProps } from "./datetime-field";

/**
 * Web: the browser's own datetime-local input, as on the website. Its value
 * is taken as Japan time (the label says so where it matters).
 */
export function DateTimeField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  min,
}: DateTimeFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="small" weight="semibold">
        {label}
        {required ? <Text tone="danger"> *</Text> : null}
      </Text>
      {createElement("input", {
        type: "datetime-local",
        value,
        min: min ? toJstLocal(min) : undefined,
        required,
        "aria-label": label,
        "aria-invalid": error ? true : undefined,
        onChange: (e: { target: { value: string } }) =>
          onChange(e.target.value),
        style: {
          minHeight: TOUCH,
          boxSizing: "border-box",
          border: `1px solid ${error ? colors.red600 : colors.slate300}`,
          borderRadius: radius.md,
          background: colors.white,
          padding: `${space.sm}px ${space.md}px`,
          fontSize: font.size.md,
          color: colors.text,
          fontFamily: "inherit",
          maxWidth: 320,
        },
      })}
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: space.xs } });
