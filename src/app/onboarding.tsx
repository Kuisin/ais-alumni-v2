import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { PushPrompt } from "@/features/notifications/push-prompt";
import { useAuth } from "@/lib/auth";
import { webHref } from "@/lib/links";
import { Button, Card, colors, Screen, space, Text } from "@/ui";

const DECIDED = new Set(["PENDING_REVIEW", "REJECTED", "DEACTIVATED"]);

/**
 * Accounts that aren't approved yet. Registration (email check, LINE, the
 * application form with evidence uploads) happens on the website's
 * onboarding screens, opened here in the web view; this screen follows the
 * account state and switches to the app once the member is ACTIVE.
 */
export default function OnboardingScreen() {
  const t = useTranslations("mobile.onboarding");
  const ts = useTranslations("onboarding.status");
  const tc = useTranslations("common");
  const router = useRouter();
  const { me, refreshMe, signOut } = useAuth();

  // Back from the web view: the state may have changed.
  useFocusEffect(
    useCallback(() => {
      void refreshMe();
    }, [refreshMe]),
  );

  if (!me) return null;
  const state = me.user.state;
  const decided = DECIDED.has(state);
  const path = me.onboardingPath ?? "/app/onboarding";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Screen contentStyle={styles.content} onRefresh={refreshMe}>
        <View style={styles.brand}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            accessibilityIgnoresInvertColors
          />
          <Text variant="small" tone="muted" center>
            {t("signedInAs", { name: me.user.email ?? me.user.name })}
          </Text>
        </View>
        <Card style={styles.card}>
          <Text variant="subheading" accessibilityRole="header">
            {decided ? ts(`${state}.title`) : t("continueTitle")}
          </Text>
          <Text tone="muted">
            {decided ? ts(`${state}.body`) : t("continueBody")}
          </Text>
          <Button
            label={decided ? t("viewStatus") : t("continue")}
            variant={decided ? "secondary" : "primary"}
            onPress={() => router.push(webHref(path))}
          />
          {state === "REJECTED" || state === "DEACTIVATED" ? (
            <Button
              variant="ghost"
              label={t("contact")}
              onPress={() => router.push(webHref("/support"))}
            />
          ) : null}
        </Card>
        {state === "PENDING_REVIEW" || state === "NEEDS_INFO" ? (
          <PushPrompt variant="onboarding" />
        ) : null}
        <View style={styles.actions}>
          <Button variant="ghost" label={t("refresh")} onPress={refreshMe} />
          <Button variant="ghost" label={tc("signOut")} onPress={signOut} />
        </View>
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { gap: space.xl, paddingTop: space.xxl },
  brand: { alignItems: "center", gap: space.md },
  logo: { width: 64, height: 64, borderRadius: 16 },
  card: { gap: space.lg },
  actions: { alignItems: "center", gap: space.xs },
});
