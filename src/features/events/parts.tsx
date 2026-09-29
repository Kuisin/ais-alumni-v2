import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, radius, space, Text, TOUCH } from "@/ui";

/** Small pieces the event screens share (the website's Alert, FallbackTag, Tabs). */

type Tone = "info" | "success" | "warning" | "error";

const TONES: Record<Tone, { bg: string; border: string; fg: string }> = {
  info: { bg: colors.brand50, border: colors.brand100, fg: colors.brand800 },
  success: { bg: colors.green50, border: colors.green100, fg: colors.green700 },
  warning: { bg: colors.amber50, border: colors.amber100, fg: colors.amber900 },
  error: { bg: colors.red50, border: colors.red100, fg: colors.red700 },
};

/** A tinted message box (the website's <Alert>). */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      <Text variant="small" style={{ color: t.fg }}>
        {children}
      </Text>
    </View>
  );
}

/**
 * 「（英語のみ）」 for content that only exists in the other language:
 * inside a title's Text, or on its own line (`block`).
 */
export function FallbackTag({
  fallback,
  block = false,
}: {
  fallback: "ja" | "en" | null;
  block?: boolean;
}) {
  const t = useTranslations("common");
  if (!fallback) return null;
  const label = fallback === "en" ? t("englishOnly") : t("japaneseOnly");
  return (
    <Text variant="caption" tone="subtle" style={styles.fallback}>
      {block ? label : ` ${label}`}
    </Text>
  );
}

/** Two or three tabs over a list (the website's underline tabs). */
export function SegmentedTabs<K extends string>({
  label,
  items,
  value,
  onChange,
}: {
  /** accessible name of the tab list */
  label: string;
  items: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={styles.tabs}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            // 38 pt tall inside the 3 pt frame: 44 pt to the finger.
            hitSlop={3}
            style={({ pressed }) => [
              styles.tab,
              active ? styles.tabActive : null,
              pressed && !active ? styles.tabPressed : null,
            ]}
          >
            <Text
              variant="small"
              weight="semibold"
              numberOfLines={1}
              style={{ color: active ? colors.brand800 : colors.slate600 }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  fallback: { fontWeight: "400" },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.slate100,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    minHeight: TOUCH - 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm + 1,
    paddingHorizontal: space.sm,
  },
  tabActive: {
    backgroundColor: colors.white,
    // slate-900 at 8 % (the website's shadow-sm)
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  },
  tabPressed: { backgroundColor: colors.slate200 },
});
