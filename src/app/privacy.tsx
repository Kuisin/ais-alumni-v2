import { Stack, useRouter } from "expo-router";
import { LifeBuoy } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button, Card, Screen, space, Text } from "@/ui";

const SECTIONS = [
  "collected",
  "purpose",
  "visibility",
  "school",
  "roster",
  "line",
  "analytics",
  "evidence",
  "invites",
  "minors",
  "storage",
  "external",
  "governance",
  "retention",
  "rights",
  "requests",
  "disclaimer",
  "changes",
  "contact",
] as const;

/**
 * The privacy policy (the website's /privacy): public, signed in or not.
 * Ends with the way to contact the committee (お問い合わせ).
 */
export default function PrivacyScreen() {
  const t = useTranslations("landing.privacy");
  const ts = useTranslations("support");
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <Screen contentStyle={styles.content}>
        <Text tone="muted">{t("intro")}</Text>
        <Card style={styles.card}>
          {SECTIONS.map((key) => {
            const items = t.has(`${key}.items`)
              ? (t.raw(`${key}.items`) as string[])
              : [];
            return (
              <View key={key} style={styles.section}>
                <Text variant="subheading" accessibilityRole="header">
                  {t(`${key}.title`)}
                </Text>
                {t.has(`${key}.body`) ? <Text>{t(`${key}.body`)}</Text> : null}
                {items.map((item) => (
                  <View key={item} style={styles.item}>
                    <Text aria-hidden>•</Text>
                    <Text style={styles.flex}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </Card>
        <Button
          variant="secondary"
          label={ts("title")}
          icon={(c) => <LifeBuoy size={16} color={c} />}
          onPress={() => router.push("/support?type=QUESTION&topic=PRIVACY")}
          style={styles.start}
        />
        <Text variant="small" tone="subtle">
          {t("updated")}
        </Text>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  start: { alignSelf: "flex-start" },
  content: { width: "100%", maxWidth: 720, alignSelf: "center" },
  card: { gap: space.xl },
  section: { gap: space.sm },
  item: { flexDirection: "row", gap: space.sm, paddingLeft: space.xs },
});
