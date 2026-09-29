import type { NewsFallback } from "@contract/news";
import { Megaphone } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { TIME_ZONE } from "@/lib/format";
import { Card, colors, radius, space, Text } from "@/ui";

/** Small pieces the news screens share (the website's news components). */

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
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      {title ? (
        <Text variant="small" weight="semibold" style={{ color: t.fg }}>
          {title}
        </Text>
      ) : null}
      {children ? (
        <Text variant="small" style={{ color: t.fg }}>
          {children}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * 「（英語のみ）」 when content is shown in the other language (§12):
 * inside a title's Text, or on its own line (`block`).
 */
export function FallbackTag({
  fallback,
  block = false,
}: {
  fallback: NewsFallback;
  block?: boolean;
}) {
  const t = useTranslations("common");
  if (!fallback) return null;
  const label = fallback === "en" ? t("englishOnly") : t("japaneseOnly");
  return (
    <Text variant="caption" tone="subtle" weight="regular">
      {block ? label : ` ${label}`}
    </Text>
  );
}

/** 「発信：教職員」 — who a post comes from, as a role. */
export function SenderTag({ sender }: { sender: string }) {
  const t = useTranslations("news.sender");
  if (!sender) return null;
  return (
    <View style={styles.meta}>
      <Megaphone size={16} color={colors.slate600} aria-hidden />
      <Text variant="small" tone="muted" style={styles.shrink}>
        {t("from", { role: sender })}
      </Text>
    </View>
  );
}

/** 「未読」: a dot plus the word, so it doesn't rely on colour alone. */
export function UnreadBadge() {
  const t = useTranslations("news");
  return (
    <View style={styles.unread}>
      <View style={styles.dot} />
      <Text variant="caption" weight="semibold" style={styles.unreadText}>
        {t("unread")}
      </Text>
    </View>
  );
}

/** A card with an icon heading (the hub's sections). */
export function HubSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHead}>
        {icon}
        <Text variant="subheading" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </Card>
  );
}

/**
 * Hub dates as the website's hub shows them (news-hub.tsx useFormat):
 * Japan time, month + day (+ weekday) + time — ja 10月3日(土) 14:00.
 */
export function useHubFormat(): (iso: string, withWeekday?: boolean) => string {
  const { locale } = useAuth();
  return (iso, withWeekday = true) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
      timeZone: TIME_ZONE,
      month: "short",
      day: "numeric",
      ...(withWeekday ? { weekday: "short" } : {}),
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
}

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  shrink: { flexShrink: 1 },
  unread: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.red50,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red600,
  },
  unreadText: { color: colors.red700 },
  section: { gap: space.md },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
