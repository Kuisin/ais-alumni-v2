import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { API_URL, PRODUCTION_URL } from "@/lib/config";
import { space, Text, TOUCH } from "@/ui";

/**
 * Bottom of マイページ: the privacy notice, app version (and the server, when
 * it isn't production), the site's footer line.
 */
export function AppInfo() {
  const tc = useTranslations("common");
  const tm = useTranslations("mobile.me");
  const version = Constants.expoConfig?.version;
  const server = API_URL === PRODUCTION_URL ? null : API_URL;
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push("/privacy")}
        style={styles.link}
      >
        <Text variant="small" tone="brand" style={styles.underline}>
          {tc("privacy")}
        </Text>
      </Pressable>
      {version ? (
        <Text variant="caption" tone="subtle" center>
          {tm("version", { version })}
        </Text>
      ) : null}
      {server ? (
        <Text variant="caption" tone="subtle" center selectable>
          {server.replace(/^https?:\/\//, "")}
        </Text>
      ) : null}
      <Text variant="caption" tone="subtle" center>
        {tc("footer")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space.xs, paddingHorizontal: space.md },
  link: { minHeight: TOUCH, justifyContent: "center" },
  underline: { textDecorationLine: "underline" },
});
