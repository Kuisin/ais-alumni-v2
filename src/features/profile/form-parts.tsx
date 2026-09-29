import { useHeaderHeight } from "expo-router/react-navigation";
import { type ReactNode, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  type Choice,
  ChoiceList,
  SelectField,
} from "@/features/people/choices";
import { Sheet } from "@/features/people/sheet";
import { colors, radius, Screen, space, Text } from "@/ui";
import type { FormStatus } from "./api";

/** A form screen: scrolls, and keeps its fields above the keyboard. */
export function FormScreen({ children }: { children: ReactNode }) {
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <Screen>{children}</Screen>
    </KeyboardAvoidingView>
  );
}

/**
 * The line under a website form: its success message (green) or why it
 * was rejected (red). `t` translates the form's message keys.
 */
export function FormMessage({
  status,
  t,
  showFieldErrors = true,
}: {
  status: FormStatus;
  t: (key: string) => string;
  /** false: only messages of rejections without field errors (as some forms) */
  showFieldErrors?: boolean;
}) {
  const te = useTranslations("mobile.errors");
  if (!status) return null;
  if (status.ok)
    return status.message ? (
      <View style={[styles.box, styles.ok]} accessibilityLiveRegion="polite">
        <Text variant="small" tone="success" weight="medium">
          {t(status.message)}
        </Text>
      </View>
    ) : null;
  const { error } = status;
  if (error?.fieldErrors && !showFieldErrors) return null;
  return (
    <View
      style={[styles.box, styles.bad]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text variant="small" tone="danger" weight="medium">
        {error ? t(error.message) : te(status.offline ? "network" : "generic")}
      </Text>
    </View>
  );
}

/** A <select>: the chosen label; the options open in a bottom sheet. */
export function SelectSheet({
  label,
  choices,
  value,
  onChange,
  placeholder,
  error,
  hint,
}: {
  label: string;
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  /** shown while nothing is chosen (the "選択してください" option) */
  placeholder?: string;
  error?: string | null;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = choices.find((c) => c.value === value)?.label;
  return (
    <View style={styles.field}>
      <SelectField
        label={label}
        value={chosen ?? placeholder ?? "—"}
        onPress={() => setOpen(true)}
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
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <ChoiceList
          label={label}
          choices={choices}
          value={value}
          onChange={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

/** A group heading inside a form (the website's <legend>). */
export function Legend({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.legend}>
      <Text weight="semibold" accessibilityRole="header">
        {title}
      </Text>
      {hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: space.xs },
  legend: { gap: 2 },
  box: { borderRadius: radius.md, padding: space.md, borderWidth: 1 },
  ok: { backgroundColor: colors.green50, borderColor: colors.green100 },
  bad: { backgroundColor: colors.red50, borderColor: colors.red100 },
});
