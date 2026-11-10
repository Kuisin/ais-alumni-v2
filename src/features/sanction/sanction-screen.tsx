import type { MySanction } from "@contract/core";
import { useRouter } from "expo-router";
import { Ban, LifeBuoy, PauseCircle } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { DeleteAccount, ExportSection } from "@/features/me/account-sections";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Button, Card, colors, Screen, space, Text } from "@/ui";

/**
 * Instead of the app while the member is SUSPENDED or BANNED: what the
 * committee decided (level, reason, until when), お問い合わせ to appeal,
 * and what still works — their data, deleting the account, signing out.
 */
export function SanctionScreen({ sanction }: { sanction: MySanction }) {
  const t = useTranslations("mobile.sanction");
  const tc = useTranslations("common");
  const tset = useTranslations("settings");
  const router = useRouter();
  const { signOut, refreshMe, locale } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const banned = sanction.level === "BANNED";
  const Icon = banned ? Ban : PauseCircle;

  const refresh = async () => {
    setRefreshing(true);
    await refreshMe().catch(() => {});
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Screen
        contentStyle={styles.content}
        refreshing={refreshing}
        onRefresh={refresh}
      >
        <View style={styles.head}>
          <Icon size={40} color={colors.red700} aria-hidden />
          <Text variant="heading" center accessibilityRole="header">
            {banned ? t("banned.title") : t("suspended.title")}
          </Text>
          <Text tone="muted" center>
            {banned
              ? t("banned.body")
              : t("suspended.body", {
                  until: sanction.endsAt
                    ? t("suspended.bodyUntil", {
                        date: formatDate(sanction.endsAt, locale),
                      })
                    : t("suspended.bodyIndefinite"),
                })}
          </Text>
        </View>

        <Card style={styles.card}>
          <Fact label={t("levelLabel")}>{t(`levels.${sanction.level}`)}</Fact>
          {banned ? null : (
            <Fact label={t("period")}>
              {sanction.endsAt
                ? t("until", { date: formatDate(sanction.endsAt, locale) })
                : t("untilLifted")}
            </Fact>
          )}
          <Fact label={t("reason")}>{sanction.reason}</Fact>
        </Card>

        <View style={styles.gap}>
          <Text variant="small" tone="muted">
            {t("appeal")}
          </Text>
          <Button
            label={t("contact")}
            icon={(c) => <LifeBuoy size={18} color={c} aria-hidden />}
            onPress={() => router.push("/support")}
          />
          <Button
            variant="secondary"
            label={tc("signOut")}
            onPress={() => void signOut()}
          />
        </View>

        <View style={[styles.gap, styles.divider]}>
          <Text variant="small" tone="muted">
            {t("screen.yourData")}
          </Text>
          <ExportSection />
          {deleting ? (
            <Card>
              <DeleteAccount onCancel={() => setDeleting(false)} />
            </Card>
          ) : (
            <Button
              variant="ghost"
              compact
              label={tset("delete.button")}
              onPress={() => setDeleting(true)}
            />
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="caption" tone="subtle" weight="medium">
        {label}
      </Text>
      <Text selectable>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    gap: space.xl,
    paddingTop: space.xl,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  head: { alignItems: "center", gap: space.md },
  card: { gap: space.md },
  fact: { gap: space.xs },
  gap: { gap: space.md },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.xl,
  },
});
