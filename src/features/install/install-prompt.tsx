import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { APP_STORE_URL } from "@/lib/app-store";
import { Button, colors, radius, space, Text } from "@/ui";
import { isIosSafari, openInApp } from "./open-app";
import { installDevice, usePwaInstall } from "./pwa";

const LATER_KEY = "ais.installPromptLater";
/** 「あとで」 hides the popup this long. */
const LATER_MS = 14 * 86_400_000;

/**
 * The web app's popup at the bottom about the app, by browser:
 *  - Safari on an iPhone: none — Safari shows its own Smart App Banner
 *    (src/app/+html.tsx) with 「開く」 / 「入手」.
 *  - Other browsers on an iPhone (Chrome, LINE's in-app browser…):
 *    「アプリで開く」 — this page in the app (open-app.ts), or the App Store.
 *  - Android: adding the web app to the home screen (/install).
 *  - Anything else (a computer): the app is on the App Store (/install).
 * Web only — the app itself never shows it, nor does the web app once it's
 * on the home screen. 「あとで」 hides it for two weeks (localStorage).
 */
export function InstallPrompt() {
  if (Platform.OS !== "web") return null;
  return <WebInstallPrompt />;
}

type Kind = "openApp" | "android" | "store";

function WebInstallPrompt() {
  const t = useTranslations("mobile.install");
  const { installed } = usePwaInstall();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Decided after mount: the server render has no localStorage.
  const [show, setShow] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);

  useEffect(() => {
    const device = installDevice();
    setKind(
      device === "android"
        ? "android"
        : device === "ios"
          ? isIosSafari()
            ? null
            : "openApp"
          : "store",
    );
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

  // Not over the install page itself, admin mode, donations (web only) or
  // an open chat (its composer sits where the popup would).
  const hidden =
    pathname === "/install" ||
    pathname === "/moved" ||
    pathname.startsWith("/donate") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/chat/");
  if (!show || hidden || installed || kind === null) return null;
  const ns =
    kind === "openApp"
      ? "openApp"
      : kind === "android"
        ? "promptAndroid"
        : "prompt";
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR + space.sm }]}
    >
      <View style={styles.card} accessibilityRole="alert">
        <View style={styles.head}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.icon}
            accessibilityIgnoresInvertColors
            aria-hidden
          />
          <View style={styles.flex}>
            <Text weight="semibold">{t(`${ns}.title`)}</Text>
            <Text variant="small" tone="muted">
              {t(`${ns}.body`)}
            </Text>
          </View>
        </View>
        <View style={styles.buttons}>
          {kind === "openApp" ? (
            <>
              <Button
                compact
                label={t("openApp.open")}
                icon={(c) => <ExternalLink size={16} color={c} aria-hidden />}
                onPress={() => {
                  const { pathname: path, search } = window.location;
                  openInApp(path + search);
                }}
              />
              <Button
                variant="secondary"
                compact
                label={t("openApp.get")}
                onPress={() => {
                  later();
                  void Linking.openURL(APP_STORE_URL).catch(() => {});
                }}
              />
            </>
          ) : (
            <Button
              compact
              label={t(`${ns}.open`)}
              onPress={() => {
                later();
                router.push("/install");
              }}
            />
          )}
          <Button
            variant="ghost"
            compact
            label={t("prompt.later")}
            onPress={later}
          />
        </View>
      </View>
    </View>
  );
}

/** Above the tab bar (and clear of the composer on other screens). */
const TAB_BAR = 68;

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
  icon: { width: 40, height: 40, borderRadius: 9 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
