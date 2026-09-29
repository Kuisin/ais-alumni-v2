import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { PushPrompt } from "@/features/notifications/push-prompt";
import { useAuth } from "@/lib/auth";
import { Button, Card, colors, Screen, space, Text } from "@/ui";

const DECIDED = new Set(["PENDING_REVIEW", "REJECTED", "DEACTIVATED"]);

/**
 * Accounts that aren't approved yet: where the application stands. The
 * registration forms (email check, LINE, the application with evidence
 * uploads) are being built into the app; this screen follows the account
 * state and switches to the app once the member is ACTIVE.
 */
export default function OnboardingScreen() {
  const t = useTranslations("mobile.onboarding");
  const ts = useTranslations("onboarding.status");
  const tc = useTranslations("common");
  const { me, refreshMe, signOut } = useAuth();

  // Back in the app: the state may have changed.
  useFocusEffect(
    useCallback(() => {
      void refreshMe();
    }, [refreshMe]),
  );

  if (!me) return null;
  const state = me.user.state;
  const decided = DECIDED.has(state);

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
