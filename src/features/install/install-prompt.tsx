import { usePathname, useRouter } from "expo-router";
import { Smartphone } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Button, colors, radius, space, Text } from "@/ui";
import { installDevice, usePwaInstall } from "./pwa";

const LATER_KEY = "ais.installPromptLater";
/** 「あとで」 hides the popup this long. */
const LATER_MS = 14 * 86_400_000;

/**
 * 「アプリ版が使えます」 on the web app: a popup at the bottom that leads to
 * /install (how to get the app). Web only — the app itself never shows it,
 * nor does the web app once it's on the home screen. On Android it offers
 * adding the web app to the home screen instead of the iPhone app.
 * 「あとで」 hides it for two weeks (localStorage).
 */
export function InstallPrompt() {
  if (Platform.OS !== "web") return null;
  return <WebInstallPrompt />;
}

function WebInstallPrompt() {
  const tIos = useTranslations("mobile.install.prompt");
  const tAndroid = useTranslations("mobile.install.promptAndroid");
  const { installed } = usePwaInstall();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Decided after mount: the server render has no localStorage.
  const [show, setShow] = useState(false);
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    setAndroid(installDevice() === "android");
    try {
      const until = Number(globalThis.localStorage?.getItem(LATER_KEY) ?? 0);
      setShow(!(until > Date.now()));
    } catch {
      setShow(true);
    }
  }, []);

  const later = () => {
    setShow(false);
    try {
      globalThis.localStorage?.setItem(
        LATER_KEY,
        String(Date.now() + LATER_MS),
      );
    } catch {
      // Private browsing: it just comes back next time.
    }
  };

  // Not over the install page itself, admin mode or an open chat (its
  // composer sits where the popup would).
  const hidden =
    pathname === "/install" ||
    pathname === "/moved" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/chat/");
  if (!show || hidden || installed) return null;
  const t = android ? tAndroid : tIos;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR + space.sm }]}
    >
      <View style={styles.card} accessibilityRole="alert">
        <View style={styles.head}>
          <Smartphone size={20} color={colors.brand700} aria-hidden />
          <View style={styles.flex}>
            <Text weight="semibold">{t("title")}</Text>
            <Text variant="small" tone="muted">
              {t("body")}
            </Text>
          </View>
        </View>
        <View style={styles.buttons}>
          <Button
            compact
            label={t("open")}
            onPress={() => {
              later();
              router.push("/install");
            }}
          />
          <Button
            variant="ghost"
            compact
            label={tIos("later")}
            onPress={later}
          />
        </View>
      </View>
    </View>
  );
}

/** Above the tab bar (and clear of the composer on other screens). */
const TAB_BAR = 64;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: space.md,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.15)",
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  buttons: { flexDirection: "row", gap: space.sm },
});
