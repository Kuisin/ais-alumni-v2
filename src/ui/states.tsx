import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ApiError } from "@/lib/api";
import { Button } from "./button";
import { FoldCenter } from "./fold";
import { Text } from "./text";
import { colors, space } from "./theme";

export function Loading({ inline = false }: { inline?: boolean }) {
  return inline ? (
    <View style={styles.inline}>
      <ActivityIndicator color={colors.brand700} />
    </View>
  ) : (
    <FoldCenter style={styles.fill}>
      <ActivityIndicator color={colors.brand700} />
    </FoldCenter>
  );
}

/** What went wrong, in the member's language, with a retry button. */
const SANCTION_CODES = new Set(["restricted", "suspended", "banned"]);

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const t = useTranslations("mobile.errors");
  const tc = useTranslations("common.errors");
  const ts = useTranslations("mobile.sanction.errors");
  const message =
    error instanceof ApiError
      ? SANCTION_CODES.has(error.code)
        ? // 処分: refused while restricted / suspended / banned
          ts(error.code as "restricted" | "suspended" | "banned")
        : error.status === 0
          ? t("network")
          : error.status === 404
            ? tc("notFound")
            : error.status === 403
              ? tc("forbidden")
              : t("generic")
      : t("generic");
  return (
    <FoldCenter style={styles.fill}>
      <Text tone="muted" center>
        {message}
      </Text>
      {onRetry ? (
        <Button label={t("retry")} variant="secondary" onPress={onRetry} />
      ) : null}
    </FoldCenter>
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
  // In FoldCenter: centred, and off the iPhone Duo's fold.
  fill: {
    alignItems: "center",
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
