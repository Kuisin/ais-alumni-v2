import type { MySanction } from "@contract/core";
import { useRouter } from "expo-router";
import { AlertTriangle, LifeBuoy, MessageSquareOff } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Button, colors, radius, space, Text } from "@/ui";
import { useAckWarning, useSanctionError } from "./api";

/**
 * ホーム: the committee's 警告 (until 「確認しました」) or the 投稿制限
 * notice (while it lasts), with the reason and お問い合わせ to appeal.
 * SUSPENDED / BANNED never get here (their own screen).
 */
export function SanctionNotice({ sanction }: { sanction: MySanction }) {
  if (sanction.level === "WARNING") return <WarningCard sanction={sanction} />;
  if (sanction.level === "RESTRICTED")
    return <RestrictedCard sanction={sanction} />;
  return null;
}

function WarningCard({ sanction }: { sanction: MySanction }) {
  const t = useTranslations("mobile.sanction");
  const tm = useTranslations("mobile.errors");
  const ack = useAckWarning();
  const sanctionError = useSanctionError();
  return (
    <Box
      icon={<AlertTriangle size={22} color={colors.amber900} aria-hidden />}
      title={t("warning.title")}
      body={t("warning.body")}
      reasonLabel={t("reason")}
      reason={sanction.reason}
    >
      {ack.isError ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {sanctionError(ack.error) ?? tm("generic")}
        </Text>
      ) : null}
      <Button
        label={t("warning.ack")}
        loading={ack.isPending}
        onPress={() => ack.mutate()}
      />
    </Box>
  );
}

function RestrictedCard({ sanction }: { sanction: MySanction }) {
  const t = useTranslations("mobile.sanction");
  const { locale } = useAuth();
  return (
    <Box
      icon={<MessageSquareOff size={22} color={colors.amber900} aria-hidden />}
      title={t("restricted.title")}
      body={t("restricted.body", {
        until: sanction.endsAt
          ? t("restricted.bodyUntil", {
              date: formatDate(sanction.endsAt, locale),
            })
          : t("restricted.bodyIndefinite"),
      })}
      reasonLabel={t("reason")}
      reason={sanction.reason}
    />
  );
}

function Box({
  icon,
  title,
  body,
  reasonLabel,
  reason,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  reasonLabel: string;
  reason: string;
  children?: ReactNode;
}) {
  const t = useTranslations("mobile.sanction");
  const router = useRouter();
  return (
    <View style={styles.box} accessibilityRole="summary">
      <View style={styles.head}>
        {icon}
        <Text
          weight="semibold"
          accessibilityRole="header"
          style={[styles.flex, styles.fg]}
        >
          {title}
        </Text>
      </View>
      <Text variant="small" style={styles.fg}>
        {body}
      </Text>
      <View style={styles.reason}>
        <Text variant="caption" tone="subtle" weight="medium">
          {reasonLabel}
        </Text>
        <Text variant="small" selectable>
          {reason}
        </Text>
      </View>
      <Text variant="caption" tone="muted">
        {t("appeal")}
      </Text>
      {children}
      <Button
        variant="secondary"
        compact
        label={t("contact")}
        icon={(c) => <LifeBuoy size={16} color={c} aria-hidden />}
        onPress={() => router.push("/support")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.amber100,
    backgroundColor: colors.amber50,
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  fg: { color: colors.amber900 },
  reason: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
});
