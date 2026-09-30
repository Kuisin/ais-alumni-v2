import { Stack, useRouter } from "expo-router";
import { LifeBuoy } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button, Card, Screen, space, Text } from "@/ui";

const SECTIONS = [
  "eligibility",
  "account",
  "conduct",
  "zeroTolerance",
  "content",
  "termination",
  "disclaimer",
  "changes",
  "contact",
] as const;

/**
 * The terms of use (利用規約): public, signed in or not. Agreed to on the
 * sign-in screen; states the zero tolerance for objectionable content and
 * abusive users that App Store guideline 1.2 asks for.
 */
export default function TermsScreen() {
  const t = useTranslations("landing.terms");
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
          onPress={() => router.push("/support")}
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
