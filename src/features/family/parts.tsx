import type { CohortChoice } from "@contract/family";
import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ChoiceList, SelectField } from "@/features/people/choices";
import { Sheet } from "@/features/people/sheet";
import { Card, colors, radius, space, Text } from "@/ui";

type NoticeTone = "success" | "error" | "info" | "warning";

const NOTICE: Record<NoticeTone, { bg: string; border: string; fg: string }> = {
  success: {
    bg: colors.green50,
    border: colors.green100,
    fg: colors.green700,
  },
  error: { bg: colors.red50, border: colors.red100, fg: colors.red700 },
  info: { bg: colors.brand50, border: colors.brand100, fg: colors.brand800 },
  warning: {
    bg: colors.amber50,
    border: colors.amber100,
    fg: colors.amber900,
  },
};

/** The website's <Alert>: a tinted box with a message. */
export function Notice({
  tone,
  children,
}: {
  tone: NoticeTone;
  children: ReactNode;
}) {
  const s = NOTICE[tone];
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: s.bg, borderColor: s.border }]}
    >
      <Text variant="small" style={{ color: s.fg }}>
        {children}
      </Text>
    </View>
  );
}

/** A card with a heading and an optional description (a page section). */
export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text variant="subheading" accessibilityRole="header">
          {title}
        </Text>
        {description ? (
          <Text variant="small" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

/** A 学年 <select>: the chosen class, opening the list in a sheet. */
export function CohortPicker({
  label,
  hint,
  placeholder,
  cohorts,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  cohorts: CohortChoice[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = cohorts.find((c) => c.value === value);
  return (
    <View style={styles.field}>
      <SelectField
        label={label}
        value={chosen?.label ?? placeholder}
        onPress={() => setOpen(true)}
      />
      {hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <ChoiceList
          label={label}
          choices={cohorts}
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

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  card: { gap: space.md },
  head: { gap: space.xs },
  field: { gap: space.xs },
});
