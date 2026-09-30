import type { AppConfig } from "@contract/core";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Download } from "lucide-react-native";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { api } from "@/lib/api";
import { Button, colors, space, Text } from "@/ui";

/** -1, 0 or 1, comparing "1.2.10" and "1.3" part by part. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * The server's /config (shared with the sign-in screen). When this build is
 * older than its minAppVersion, the store link to update (or null when the
 * server doesn't know it); undefined while it's fine or unknown. The web app
 * is always current, and a failed request never blocks the app.
 */
type UpdateRequired = {
  url: string | null;
  retry: () => void;
  checking: boolean;
};

export function useUpdateRequired(): UpdateRequired | undefined {
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<AppConfig>("/config"),
    staleTime: 5 * 60_000,
    enabled: Platform.OS !== "web",
  });
  const min = config.data?.minAppVersion;
  const version = Constants.expoConfig?.version;
  if (!min || !version || compareVersions(version, min) >= 0) return undefined;
  const store = config.data?.storeUrl;
  return {
    url: (Platform.OS === "ios" ? store?.ios : store?.android) ?? null,
    retry: () => void config.refetch(),
    checking: config.isFetching,
  };
}

/** Instead of the app, when this version no longer works with the server. */
export function UpdateRequired({ url, retry, checking }: UpdateRequired) {
  const t = useTranslations("mobile.update");
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Download size={40} color={colors.slate400} aria-hidden />
        <Text variant="subheading" center accessibilityRole="header">
          {t("title")}
        </Text>
        <Text tone="muted" center>
          {t("body")}
        </Text>
        {url ? (
          <Button
            label={t("open")}
            onPress={() => void Linking.openURL(url).catch(() => {})}
          />
        ) : null}
        <Button
          variant="ghost"
          label={t("retry")}
          loading={checking}
          onPress={retry}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: space.xl,
  },
});
