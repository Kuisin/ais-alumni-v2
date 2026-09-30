import enMobile from "@messages/en/mobile.json";
import jaMobile from "@messages/ja/mobile.json";
import type { ErrorBoundaryProps } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { deviceLocale } from "@/lib/locale";
import { Button, colors, space, Text } from "@/ui";

/**
 * The root layout's error boundary: a screen that failed to render shows
 * this, with the error to quote to support, instead of closing the app.
 * It sits outside the providers, so the texts come straight from the
 * message files (in the phone's language).
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const t = (deviceLocale() === "en" ? enMobile : jaMobile).errors.crash;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <TriangleAlert size={40} color={colors.slate400} aria-hidden />
        <Text variant="subheading" center accessibilityRole="header">
          {t.title}
        </Text>
        <Text tone="muted" center>
          {t.body}
        </Text>
        <Button label={t.retry} onPress={() => void retry()} />
        <View style={styles.details}>
          <Text variant="caption" tone="subtle" selectable>
            {error.message}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: space.xl,
  },
  details: { alignSelf: "stretch", paddingTop: space.md },
});
