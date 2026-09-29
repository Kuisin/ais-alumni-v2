import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import { SupportForm } from "@/features/public/support-form";
import { Card, Screen, Text } from "@/ui";

/**
 * お問い合わせ (the website's /support): public — people who can't sign in
 * need it most; members get their name and email filled in.
 * `?type=&topic=` preselects the dropdowns.
 */
export default function SupportScreen() {
  const t = useTranslations("support");
  const { type, topic } = useLocalSearchParams<{
    type?: string;
    topic?: string;
  }>();
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <Screen contentStyle={styles.content}>
        <Text tone="muted">{t("intro")}</Text>
        <Card>
          <SupportForm type={type} topic={topic} />
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 720, alignSelf: "center" },
});
