import { useRouter } from "expo-router";
import {
  BellRing,
  CalendarCheck,
  type LucideIcon,
  MessageCircle,
  Newspaper,
} from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { usePush } from "@/lib/push";
import { Button, colors, radius, space, Text } from "@/ui";

const POINTS: { key: "chat" | "news" | "events"; icon: LucideIcon }[] = [
  { key: "chat", icon: MessageCircle },
  { key: "news", icon: Newspaper },
  { key: "events", icon: CalendarCheck },
];

/**
 * First launch after install (src/lib/push.tsx opens it once): what app
 * notifications bring, before the phone's own permission dialog — which
 * 「通知をオンにする」 then shows. 「あとで」 leaves it to the Home card and
 * settings.
 */
export default function NotificationsIntro() {
  const t = useTranslations("mobile.push.intro");
  const push = usePush();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const enable = async () => {
    setBusy(true);
    try {
      await push.askPermission();
    } finally {
      setBusy(false);
      close();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.icon}>
          <BellRing size={40} color={colors.brand700} aria-hidden />
        </View>
        <Text variant="heading" center accessibilityRole="header">
          {t("title")}
        </Text>
        <Text tone="muted" center>
          {t("body")}
        </Text>
        <View style={styles.points}>
          {POINTS.map(({ key, icon: Icon }) => (
            <View key={key} style={styles.point}>
              <Icon size={22} color={colors.brand700} aria-hidden />
              <View style={styles.flex}>
                <Text weight="semibold">{t(`points.${key}.title`)}</Text>
                <Text variant="small" tone="muted">
                  {t(`points.${key}.body`)}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Text variant="small" tone="muted" center>
          {t("note")}
        </Text>
      </ScrollView>
      <View style={styles.buttons}>
        <Button
          label={t("enable")}
          loading={busy}
          onPress={() => void enable()}
        />
        <Button
          variant="ghost"
          label={t("later")}
          disabled={busy}
          onPress={close}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: space.lg,
    padding: space.xl,
  },
  icon: {
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand50,
  },
  points: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  point: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  flex: { flex: 1, gap: 2 },
  buttons: { gap: space.sm, padding: space.xl, paddingTop: space.sm },
});
