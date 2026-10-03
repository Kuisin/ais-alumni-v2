import { type Href, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowRight, Smartphone } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { hrefFor } from "@/lib/links";
import { Button, Card, colors, Screen, space, Text } from "@/ui";

/** Pages anyone can open (the rest need signing in first). */
const PUBLIC = new Set([
  "/privacy",
  "/terms",
  "/support",
  "/install",
  "/donate",
]);

/**
 * 「サイトが移転しました」 (public): where the old website
 * (ais.kai-lab.net, Kuisin/ais-alumni-app) sends its pages — a Vercel
 * routing rule on that project redirects them here with ?from=<old path>.
 * The link goes to the same page here when there is one (src/lib/links.ts),
 * else Home; signed out, to the landing page to sign in first (member pages
 * aren't reachable before that).
 */
export default function MovedScreen() {
  const t = useTranslations("mobile.moved");
  const router = useRouter();
  const { status } = useAuth();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const page =
    typeof from === "string" && from.startsWith("/") ? hrefFor(from) : null;
  const target: Href =
    status === "signedIn"
      ? (page ?? "/")
      : typeof page === "string" && PUBLIC.has(page.split("?")[0] ?? "")
        ? page
        : "/";
  return (
    <Screen contentStyle={styles.content}>
      <Stack.Screen options={{ title: t("title") }} />
      <Card style={styles.card}>
        <Text variant="heading" accessibilityRole="header">
          {t("title")}
        </Text>
        <Text>{t("body")}</Text>
        <Button
          label={t("open")}
          icon={(c) => <ArrowRight size={18} color={c} aria-hidden />}
          onPress={() => router.replace(target)}
        />
        <Text variant="small" tone="muted">
          {t("bookmark")}
        </Text>
      </Card>
      <View style={styles.row}>
        <Smartphone size={18} color={colors.brand700} aria-hidden />
        <Button
          variant="ghost"
          compact
          label={t("app")}
          onPress={() => router.push("/install")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 560, alignSelf: "center", gap: space.lg },
  card: { gap: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
