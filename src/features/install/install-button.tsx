import { useRouter } from "expo-router";
import { Download } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useTranslations } from "use-intl";
import { Button } from "@/ui";
import { installDevice, usePwaInstall } from "./pwa";

/**
 * 「アプリをインストール」 on マイページ: always there in a browser — unlike
 * the popup (install-prompt.tsx), which 「あとで」 hides — and leads to
 * /install. Not in the apps, nor in the web app opened from the home
 * screen: there it's already installed.
 */
export function InstallButton() {
  if (Platform.OS !== "web") return null;
  return <WebInstallButton />;
}

function WebInstallButton() {
  const t = useTranslations("mobile.install");
  const router = useRouter();
  const { installed } = usePwaInstall();
  // Known after mount: the server render can't see the browser.
  const [android, setAndroid] = useState(false);
  useEffect(() => setAndroid(installDevice() === "android"), []);
  if (installed) return null;
  return (
    <Button
      variant="secondary"
      label={android ? t("android.install") : t("button")}
      icon={(c) => <Download size={18} color={c} aria-hidden />}
      onPress={() => router.push("/install")}
    />
  );
}
