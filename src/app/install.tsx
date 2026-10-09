import type { AppConfig } from "@contract/core";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import {
  ArrowLeftRight,
  BellRing,
  CircleCheck,
  Download,
  ExternalLink,
  MessageCircleReply,
  QrCode,
  RefreshCw,
  Smartphone,
  Zap,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  type InstallDevice,
  installDevice,
  usePwaInstall,
} from "@/features/install/pwa";
import { Chips } from "@/features/people/choices";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePush } from "@/lib/push";
import { Button, Card, colors, Loading, Screen, space, Text } from "@/ui";

const TESTFLIGHT_APP = "https://apps.apple.com/app/testflight/id899247664";

/** One icon per benefit (mobile.install.benefits.items, in order). */
const BENEFIT_ICONS = [BellRing, Zap, MessageCircleReply, Smartphone, QrCode];

const open = (url: string) => void Linking.openURL(url).catch(() => {});

/** One icon per Android benefit (mobile.install.android.benefits). */
const ANDROID_BENEFIT_ICONS = [BellRing, Smartphone, RefreshCw];

/**
 * アプリのインストール (public): how to get the app on this phone. An
 * iPhone gets the iOS app's steps (IosInstall); Android gets the web app
 * added to the home screen, with notifications (AndroidInstall). The phone
 * is recognized from the browser; anything else (a computer) gets a choice
 * at the top, and a recognized phone a small button at the bottom to see
 * the other one's steps, in case the guess is wrong.
 */
export default function InstallScreen() {
  const t = useTranslations("mobile.install");
  // Known after mount: the server render can't see the browser.
  const [device, setDevice] = useState<InstallDevice | null>(
    Platform.OS === "web" ? null : installDevice(),
  );
  const [detected, setDetected] = useState<InstallDevice | null>(device);
  useEffect(() => {
    const d = installDevice();
    setDetected(d);
    setDevice((current) => current ?? (d === "android" ? "android" : "ios"));
  }, []);

  return (
    <Screen contentStyle={styles.content}>
      <Stack.Screen
        options={{
          title: device === "android" ? t("android.title") : t("title"),
        }}
      />
      {device === null ? (
        <Loading inline />
      ) : (
        <>
          {detected === "other" ? (
            <Chips
              label={t("device.label")}
              choices={[
                { value: "ios", label: t("device.ios") },
                { value: "android", label: t("device.android") },
              ]}
              value={device}
              onChange={(v) => setDevice(v as InstallDevice)}
            />
          ) : null}
          {device === "android" ? <AndroidInstall /> : <IosInstall />}
          {/* The guess can be wrong (a browser hiding what it runs on). */}
          {Platform.OS === "web" && detected !== "other" ? (
            <Button
              variant="ghost"
              compact
              label={t(
                device === "android" ? "device.toIos" : "device.toAndroid",
              )}
              icon={(c) => <ArrowLeftRight size={16} color={c} aria-hidden />}
              onPress={() =>
                setDevice(device === "android" ? "ios" : "android")
              }
              style={styles.switch}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

/**
 * Android: the web app on the home screen. Chrome's own install dialog
 * when it offered one (usePwaInstall), else the steps through its menu;
 * once it's installed, turning notifications on (Web Push).
 */
function AndroidInstall() {
  const t = useTranslations("mobile.install.android");
  const pwa = usePwaInstall();
  const steps = t.raw("steps") as string[];
  const benefits = t.raw("benefits") as [string, string][];
  return (
    <>
      <Text>{t("intro")}</Text>
      {pwa.installed ? (
        <Card style={styles.card}>
          <View style={styles.step}>
            <CircleCheck size={20} color={colors.green600} aria-hidden />
            <View style={styles.flex}>
              <Text weight="semibold">{t("installedTitle")}</Text>
              <Text variant="small" tone="muted">
                {t("installed")}
              </Text>
            </View>
          </View>
        </Card>
      ) : pwa.canPrompt ? (
        <Button
          label={t("install")}
          icon={(c) => <Download size={18} color={c} aria-hidden />}
          onPress={() => void pwa.prompt()}
        />
      ) : null}
      {pwa.installed ? <WebNotifications /> : null}
      <Card style={styles.card}>
        {benefits.map(([title, body], i) => {
          const Icon = ANDROID_BENEFIT_ICONS[i] ?? Smartphone;
          return (
            <View key={title} style={styles.step}>
              <Icon size={20} color={colors.brand700} aria-hidden />
              <View style={styles.flex}>
                <Text weight="semibold">{title}</Text>
                <Text variant="small" tone="muted">
                  {body}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>
      {pwa.installed ? null : (
        <>
          <Card style={styles.card}>
            <Text variant="subheading" accessibilityRole="header">
              {t("stepsTitle")}
            </Text>
            {steps.map((step, i) => (
              <View key={step} style={styles.step}>
                <Text weight="semibold" tone="brand" style={styles.number}>
                  {i + 1}
                </Text>
                <Text style={styles.flex}>{step}</Text>
              </View>
            ))}
          </Card>
          <Text variant="small" tone="muted">
            {t("lineNote")}
          </Text>
          <WebNotifications />
        </>
      )}
    </>
  );
}

/** Notifications for the web app on this device, in one tap. */
function WebNotifications() {
  const t = useTranslations("mobile.install.android");
  const { status } = useAuth();
  const push = usePush();
  const [failed, setFailed] = useState(false);
  if (Platform.OS !== "web") return null;
  const denied = push.permission === "denied";
  return (
    <Card style={styles.card}>
      <View style={styles.step}>
        <BellRing size={20} color={colors.brand700} aria-hidden />
        <View style={styles.flex}>
          <Text weight="semibold">{t("notifyTitle")}</Text>
          <Text variant="small" tone="muted">
            {t("notifyBody")}
          </Text>
        </View>
      </View>
      {push.blocker ? (
        <Text variant="small" tone="muted">
          {t("notifyUnavailable")}
        </Text>
      ) : status !== "signedIn" ? (
        <Text variant="small" tone="muted">
          {t("notifySignIn")}
        </Text>
      ) : push.enabled ? (
        <Text variant="small" tone="success">
          {t("notifyOn")}
        </Text>
      ) : denied ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {t("notifyDenied")}
        </Text>
      ) : (
        <Button
          label={t("notifyEnable")}
          icon={(c) => <BellRing size={18} color={c} aria-hidden />}
          loading={push.busy}
          disabled={push.state === null}
          onPress={async () => {
            setFailed(false);
            setFailed((await push.enable()) === "failed");
          }}
        />
      )}
      {failed ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {t("notifyFailed")}
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * iPhone: once the app has an App Store link (config.storeUrl.ios) that's
 * the button; until then the steps to install it through TestFlight with
 * the committee's public link (config.install.testflightUrl, TESTFLIGHT_URL
 * on the server).
 */
function IosInstall() {
  const t = useTranslations("mobile.install");
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<AppConfig>("/config"),
    staleTime: 5 * 60_000,
  });
  const store = config.data?.storeUrl?.ios ?? null;
  const testflight = config.data?.install?.testflightUrl ?? null;
  const steps = t.raw("steps") as string[];
  const notes = t.raw("notes") as string[];
  const benefits = t.raw("benefits.items") as [string, string][];
  const whatImproves = (
    <Card style={styles.card}>
      <Text variant="subheading" accessibilityRole="header">
        {t("benefits.title")}
      </Text>
      {benefits.map(([title, body], i) => {
        const Icon = BENEFIT_ICONS[i] ?? Smartphone;
        return (
          <View key={title} style={styles.step}>
            <Icon size={20} color={colors.brand700} aria-hidden />
            <View style={styles.flex}>
              <Text weight="semibold">{title}</Text>
              <Text variant="small" tone="muted">
                {body}
              </Text>
            </View>
          </View>
        );
      })}
    </Card>
  );

  return (
    <>
      {config.data === undefined ? (
        <Loading inline />
      ) : store ? (
        <>
          <Text>{t("storeIntro")}</Text>
          <Button
            label={t("openAppStore")}
            icon={(c) => <Download size={18} color={c} aria-hidden />}
            onPress={() => open(store)}
          />
          {whatImproves}
        </>
      ) : (
        <>
          <Text>{t("intro")}</Text>
          {whatImproves}
          <Card style={styles.card}>
            <Text variant="subheading" accessibilityRole="header">
              {t("stepsTitle")}
            </Text>
            {steps.map((step, i) => (
              <View key={step} style={styles.step}>
                <Text weight="semibold" tone="brand" style={styles.number}>
                  {i + 1}
                </Text>
                <View style={styles.flex}>
                  <Text>{step}</Text>
                  {i === 0 ? (
                    <Button
                      variant="secondary"
                      compact
                      label={t("getTestflight")}
                      icon={(c) => (
                        <ExternalLink size={16} color={c} aria-hidden />
                      )}
                      onPress={() => open(TESTFLIGHT_APP)}
                      style={styles.inline}
                    />
                  ) : null}
                </View>
              </View>
            ))}
            {testflight ? (
              <Button
                label={t("openTestflight")}
                icon={(c) => <Download size={18} color={c} aria-hidden />}
                onPress={() => open(testflight)}
              />
            ) : (
              <Text tone="muted">{t("notReady")}</Text>
            )}
          </Card>
          <Text variant="small" tone="muted">
            {t("lineNote")}
          </Text>
          {notes.map((note) => (
            <View key={note} style={styles.note}>
              <Text variant="small" tone="subtle" aria-hidden>
                •
              </Text>
              <Text variant="small" tone="subtle" style={styles.flex}>
                {note}
              </Text>
            </View>
          ))}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: "100%", maxWidth: 640, alignSelf: "center", gap: space.lg },
  card: { gap: space.lg },
  step: { flexDirection: "row", gap: space.md },
  number: { width: 20 },
  inline: { alignSelf: "flex-start", marginTop: space.sm },
  note: { flexDirection: "row", gap: space.sm },
  switch: { alignSelf: "center" },
});
