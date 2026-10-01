import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react-native";
import { useEffect } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { api } from "@/lib/api";
import { useOffline } from "@/lib/connectivity";
import { colors, radius, space, Text } from "@/ui";

/** While offline, ask the server this often whether it's back. */
const PROBE_MS = 8000;

/**
 * 「オフライン・保存したデータを表示しています」, floating under the header
 * while the server can't be reached (src/lib/connectivity.ts). Asks the
 * public /config at launch and on return to the foreground, and every few
 * seconds while offline; when it answers again, every screen refreshes.
 */
export function OfflineIndicator() {
  const t = useTranslations("mobile.offline");
  const offline = useOffline();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Check at launch and whenever the app comes to the foreground — saved
  // data can be fresh enough that no screen asks the server by itself.
  // api() reports each result to connectivity.
  useEffect(() => {
    const check = () => void api("/config").catch(() => {});
    check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, []);

  // While offline, keep asking; once the server answers, refresh the data.
  useEffect(() => {
    if (!offline) return;
    let stopped = false;
    const timer = setInterval(() => {
      api("/config")
        .then(() => {
          if (!stopped) void queryClient.invalidateQueries();
        })
        .catch(() => {});
    }, PROBE_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [offline, queryClient]);

  if (!offline) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + HEADER + space.sm }]}
    >
      <View
        style={styles.pill}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${t("banner")}. ${t("hint")}`}
      >
        <WifiOff size={16} color={colors.white} aria-hidden />
        <Text variant="small" weight="semibold" style={styles.text}>
          {t("banner")}
        </Text>
        <Text variant="caption" style={styles.text}>
          {t("hint")}
        </Text>
      </View>
    </View>
  );
}

/** Roughly a navigation header, so the pill sits just under it. */
const HEADER = Platform.OS === "web" ? 64 : 44;

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    maxWidth: "92%",
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.slate600,
  },
  text: { color: colors.white },
});
