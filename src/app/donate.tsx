import type { AppConfig } from "@contract/core";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Clock, ExternalLink, HeartHandshake } from "lucide-react-native";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { DonateForm } from "@/features/donate/donate-form";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import { Button, Card, colors, Loading, Screen, space, Text } from "@/ui";

/**
 * 寄付 (public, signed in or not). On the web: what donations pay for and
 * the form (Stripe Checkout; ?done=1 after paying). In the iOS / Android
 * app the page only opens itself in the browser: apps may collect
 * donations for an organization that isn't an Apple-approved nonprofit
 * only outside the app (App Store guideline 3.2.2(iv)). While the server
 * takes no donations yet (no live Stripe key: config.donations null),
 * 「寄付の受付は準備中です」 instead of the form.
 */
export default function DonateScreen() {
  const t = useTranslations("mobile.donate");
  const { done } = useLocalSearchParams<{ done?: string }>();
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<AppConfig>("/config"),
    staleTime: 5 * 60_000,
  });
  const web = Platform.OS === "web";

  return (
    <Screen contentStyle={styles.content}>
      <Stack.Screen options={{ title: t("title") }} />
      {done === "1" ? (
        <Card style={styles.thanks}>
          <HeartHandshake size={28} color={colors.brand700} aria-hidden />
          <Text variant="subheading" accessibilityRole="header">
            {t("thanks.title")}
          </Text>
          <Text>{t("thanks.body")}</Text>
        </Card>
      ) : null}
      <Text>{t("intro")}</Text>
      {config.data === undefined ? (
        <Loading inline />
      ) : !config.data.donations ? (
        <Preparing />
      ) : web ? (
        <DonateForm donations={config.data.donations} />
      ) : (
        <View style={styles.native}>
          <Text tone="muted">{t("appNote")}</Text>
          <Button
            label={t("openInSafari")}
            icon={(c) => <ExternalLink size={18} color={c} aria-hidden />}
            onPress={() =>
              void Linking.openURL(`${API_URL}/donate`).catch(() => {})
            }
          />
        </View>
      )}
      <Text variant="small" tone="subtle">
        {t("note")}
      </Text>
    </Screen>
  );
}

/** Donations aren't open on this server yet: say so, and a way back. */
function Preparing() {
  const t = useTranslations("mobile.donate.preparing");
  const router = useRouter();
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  return (
    <Card style={styles.thanks}>
      <Clock size={28} color={colors.brand700} aria-hidden />
      <Text variant="subheading" accessibilityRole="header">
        {t("title")}
      </Text>
      <Text>{t("body")}</Text>
      <Button
        variant="secondary"
        label={signedIn ? t("backMe") : t("backHome")}
        onPress={() =>
          router.canGoBack()
            ? router.back()
            : router.replace(signedIn ? "/me" : "/")
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 640, alignSelf: "center", gap: space.lg },
  thanks: { gap: space.sm, alignItems: "flex-start" },
  native: { gap: space.md },
});
