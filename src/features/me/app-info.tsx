import Constants from "expo-constants";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { API_URL, PRODUCTION_URL } from "@/lib/config";
import { space, Text } from "@/ui";

/**
 * Bottom of マイページ: app version (and the server, when
 * it isn't production), the site's footer line.
 */
export function AppInfo() {
  const tc = useTranslations("common");
  const tm = useTranslations("mobile.me");
  const version = Constants.expoConfig?.version;
  const server = API_URL === PRODUCTION_URL ? null : API_URL;
  return (
    <View style={styles.wrap}>
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
});
