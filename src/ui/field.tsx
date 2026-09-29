import { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { Text } from "./text";
import { colors, font, radius, space, TOUCH } from "./theme";

export type TextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
};

/** Labelled text input with hint / error text below. */
export const TextField = forwardRef<TextInput, TextFieldProps>(
  function TextField({ label, hint, error, style, ...props }, ref) {
    return (
      <View style={styles.wrap}>
        {label ? (
          <Text variant="small" weight="semibold">
            {label}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.slate400}
          accessibilityLabel={label}
          {...props}
          style={[styles.input, error ? styles.invalid : null, style]}
        />
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
  },
);

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: {
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.size.md,
    color: colors.text,
  },
  invalid: { borderColor: colors.red600 },
});
