import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Card, Screen, space, Text } from "@/ui";

const SECTIONS = [
  "collected",
  "purpose",
  "visibility",
  "line",
  "analytics",
  "evidence",
  "retention",
  "rights",
  "contact",
] as const;

/** The privacy notice (the website's /privacy): public, signed in or not. */
export default function PrivacyScreen() {
  const t = useTranslations("landing.privacy");
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
        <Text variant="small" tone="subtle">
          {t("updated")}
        </Text>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: "100%", maxWidth: 720, alignSelf: "center" },
  card: { gap: space.xl },
  section: { gap: space.sm },
  item: { flexDirection: "row", gap: space.sm, paddingLeft: space.xs },
});
