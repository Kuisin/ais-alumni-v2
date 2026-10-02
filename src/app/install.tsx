import type { AppConfig } from "@contract/core";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { Download, ExternalLink } from "lucide-react-native";
import { Linking, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { api } from "@/lib/api";
import { Button, Card, Loading, Screen, space, Text } from "@/ui";

const TESTFLIGHT_APP = "https://apps.apple.com/app/testflight/id899247664";

const open = (url: string) => void Linking.openURL(url).catch(() => {});

/**
 * アプリのインストール (public): how to get the iPhone app. Once it has an
 * App Store link (config.storeUrl.ios) that's the button; until then the
 * steps to install it through TestFlight with the committee's public link
 * (config.install.testflightUrl, TESTFLIGHT_URL on the server).
 */
export default function InstallScreen() {
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

  return (
    <Screen contentStyle={styles.content}>
      <Stack.Screen options={{ title: t("title") }} />
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
        </>
      ) : (
        <>
          <Text>{t("intro")}</Text>
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
    </Screen>
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
});
