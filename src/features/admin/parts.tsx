import type { LucideIcon } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  type Choice,
  ChoiceList,
  SelectField,
} from "@/features/people/choices";
import { ApiError } from "@/lib/api";
import { Card, colors, radius, space, Text } from "@/ui";

/**
 * Building blocks of the admin screens: the website's AdminSection cards,
 * definition lists, <select>s and form result alerts, for small screens.
 */

/** A titled card (the website's AdminSection). */
export function AdminCard({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        {Icon ? <Icon size={20} color={colors.brand700} aria-hidden /> : null}
        <Text
          variant="subheading"
          accessibilityRole="header"
          style={styles.flex}
        >
          {title}
        </Text>
      </View>
      {description ? (
        <Text variant="small" tone="muted">
          {description}
        </Text>
      ) : null}
      {children}
    </Card>
  );
}

/** Label / value pairs, stacked (a <dl>). */
export function Facts({
  rows,
}: {
  rows: [label: string, value: string | null | undefined][];
}) {
  return (
    <View style={styles.facts}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.fact}>
          <Text variant="caption" tone="subtle" weight="medium">
            {label}
          </Text>
          <Text variant="small" selectable>
            {value || "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A <select>: the chosen option; the list opens in place. */
export function Picker({
  label,
  choices,
  value,
  onChange,
  hint,
}: {
  label: string;
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = choices.find((c) => c.value === value)?.label ?? "—";
  return (
    <View style={styles.picker}>
      <SelectField
        label={label}
        value={chosen}
        expanded={open}
        onPress={() => setOpen(!open)}
      />
      {open ? (
        <ScrollView
          style={choices.length > 8 ? styles.long : undefined}
          nestedScrollEnabled
        >
          <ChoiceList
            label={label}
            choices={choices}
            value={value}
            onChange={(v) => {
              onChange(v);
              setOpen(false);
            }}
          />
        </ScrollView>
      ) : null}
      {hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** The website's <Alert>: a tinted box announcing a result. */
export function Notice({
  tone,
  children,
}: {
  tone: "success" | "error" | "info" | "warning";
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.noticeBox,
        { backgroundColor: t.bg, borderColor: t.border },
      ]}
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
  warning: { bg: colors.amber50, border: colors.amber100, fg: colors.amber900 },
} as const;

/** An action's `{ ok, message, error }` as a Notice. */
export function ResultNotice({
  result,
}: {
  result: { ok?: boolean; message?: string; error?: string } | null | undefined;
}) {
  if (!result) return null;
  if (result.error) return <Notice tone="error">{result.error}</Notice>;
  if (result.ok && result.message)
    return <Notice tone="success">{result.message}</Notice>;
  return null;
}

/** A request that failed (network, server error, no permission). */
export function FailedNotice({ error }: { error: unknown }) {
  const t = useTranslations("mobile.errors");
  const tc = useTranslations("common.errors");
  if (!error) return null;
  const text =
    error instanceof ApiError
      ? error.status === 0
        ? t("network")
        : error.status === 403
          ? tc("forbidden")
          : error.status === 404
            ? tc("notFound")
            : t("generic")
      : t("generic");
  return <Notice tone="error">{text}</Notice>;
}

/** Buttons side by side, wrapping on narrow screens. */
export function Actions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

const styles = StyleSheet.create({
  noticeBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
  },
  card: { gap: space.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  facts: { gap: space.sm },
  fact: { gap: 2 },
  picker: { gap: space.xs },
  long: { maxHeight: 320 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
