import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CalendarDays,
  HeartHandshake,
  LockKeyhole,
  type LucideIcon,
  MessageCircle,
  Newspaper,
  Users,
} from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { Button, colors, radius, Screen, space, Text, TOUCH } from "@/ui";

const FEATURES: Record<string, LucideIcon> = {
  directory: Users,
  events: CalendarDays,
  news: Newspaper,
  line: MessageCircle,
  privacy: LockKeyhole,
  family: HeartHandshake,
};
const STEPS = ["signup", "verify", "approved"] as const;

/**
 * The public landing page (the website's /[locale] page), shown at the web
 * app's root to visitors who aren't signed in. 新規登録 and ログイン both
 * go to sign-in: signing in for the first time creates the account.
 */
export function Landing() {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const tl = useTranslations("landing");
  const router = useRouter();
  const { locale, setGuestLocale } = useAuth();
  const signIn = () => router.push("/sign-in");
  const other = locale === "ja" ? "en" : "ja";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Screen contentStyle={styles.content}>
        <View style={styles.bar}>
          <View style={styles.brandRow}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              accessibilityIgnoresInvertColors
            />
            <Text weight="semibold">{tc("appName")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tc("switchLanguage")}
            onPress={() => setGuestLocale(other)}
            style={styles.lang}
          >
            <Text variant="small" tone="brand" weight="semibold">
              {other === "en" ? "English" : "日本語"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text variant="small" tone="brand" weight="semibold" center>
            {t("hero.eyebrow")}
          </Text>
          <Text variant="title" center accessibilityRole="header">
            {t("hero.title")}
          </Text>
          <Text tone="muted" center style={styles.lead}>
            {t("hero.lead")}
          </Text>
          <View style={styles.actions}>
            <Button
              label={t("hero.signUp")}
              icon={(c) => <ArrowRight size={16} color={c} />}
              onPress={signIn}
            />
            <Button
              variant="secondary"
              label={t("hero.logIn")}
              onPress={signIn}
            />
          </View>
        </View>

        <View style={styles.block}>
          <Text variant="heading" center accessibilityRole="header">
            {t("features.title")}
          </Text>
          <View style={styles.grid}>
            {Object.entries(FEATURES).map(([key, Icon]) => (
              <View key={key} style={styles.feature}>
                <View style={styles.icon}>
                  <Icon size={20} color={colors.brand700} aria-hidden />
                </View>
                <Text weight="semibold" style={styles.brandText}>
                  {t(`features.items.${key}.title`)}
                </Text>
                <Text variant="small" tone="muted">
                  {t(`features.items.${key}.body`)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text variant="heading" center accessibilityRole="header">
            {t("steps.title")}
          </Text>
          <View style={styles.grid}>
            {STEPS.map((key, i) => (
              <View key={key} style={styles.step}>
                <View style={styles.num}>
                  <Text weight="bold" tone="inverse">
                    {i + 1}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text weight="semibold">{t(`steps.items.${key}.title`)}</Text>
                  <Text variant="small" tone="muted">
                    {t(`steps.items.${key}.body`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text variant="small" tone="muted" center>
            <Text variant="small" weight="semibold">
              {`${t("audience.title")}: `}
            </Text>
            {t("audience.body")}
          </Text>
        </View>

        <View style={styles.about}>
          <Text weight="bold" center accessibilityRole="header">
            {t("about.title")}
          </Text>
          <Text variant="small" tone="muted" center>
            {t("about.body")}
          </Text>
        </View>

        <View style={styles.cta}>
          <Text variant="heading" tone="inverse" center>
            {t("cta.title")}
          </Text>
          <Text center style={styles.ctaBody}>
            {t("cta.body")}
          </Text>
          <Button
            variant="secondary"
            label={t("hero.signUp")}
            onPress={signIn}
            style={styles.ctaButton}
          />
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/privacy")}
            style={styles.link}
          >
            <Text variant="small" tone="brand" style={styles.underline}>
              {tc("privacy")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/support")}
            style={styles.link}
          >
            <Text variant="small" tone="brand" style={styles.underline}>
              {tc("nav.support")}
            </Text>
          </Pressable>
        </View>
        <Text variant="caption" tone="subtle" center>
          {tl("operatedBy")}
        </Text>
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    gap: space.xxl,
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
  },
  bar: { flexDirection: "row", alignItems: "center", gap: space.md },
  brandRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  logo: { width: 32, height: 32, borderRadius: 8 },
  lang: { minHeight: TOUCH, justifyContent: "center" },
  hero: { gap: space.md, paddingTop: space.xl, alignItems: "center" },
  lead: { maxWidth: 640 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.md,
    marginTop: space.md,
  },
  block: { gap: space.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  feature: {
    flexGrow: 1,
    flexBasis: 260,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: space.lg,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand50,
  },
  brandText: { color: colors.brand800 },
  step: {
    flexGrow: 1,
    flexBasis: 260,
    flexDirection: "row",
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.brand50,
    padding: space.lg,
  },
  num: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand700,
  },
  about: {
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: space.xl,
    maxWidth: 640,
    alignSelf: "center",
  },
  cta: {
    gap: space.md,
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.brand700,
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
  },
  ctaBody: { color: colors.brand100 },
  ctaButton: { minWidth: 160 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space.xl,
  },
  link: { minHeight: TOUCH, justifyContent: "center" },
  underline: { textDecorationLine: "underline" },
});
