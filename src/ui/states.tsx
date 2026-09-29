import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ApiError } from "@/lib/api";
import { Button } from "./button";
import { Text } from "./text";
import { colors, space } from "./theme";

export function Loading({ inline = false }: { inline?: boolean }) {
  return (
    <View style={inline ? styles.inline : styles.fill}>
      <ActivityIndicator color={colors.brand700} />
    </View>
  );
}

/** What went wrong, in the member's language, with a retry button. */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const t = useTranslations("mobile.errors");
  const tc = useTranslations("common.errors");
  const message =
    error instanceof ApiError
      ? error.status === 0
        ? t("network")
        : error.status === 404
          ? tc("notFound")
          : error.status === 403
            ? tc("forbidden")
            : t("generic")
      : t("generic");
  return (
    <View style={styles.fill}>
      <Text tone="muted" center>
        {message}
      </Text>
      {onRetry ? (
        <Button label={t("retry")} variant="secondary" onPress={onRetry} />
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text variant="body" weight="semibold" center>
        {title}
      </Text>
      {hint ? (
        <Text variant="small" tone="subtle" center>
          {hint}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: space.xl,
  },
  inline: { padding: space.xl, alignItems: "center" },
  empty: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.slate300,
    backgroundColor: colors.white,
  },
});
