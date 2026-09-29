import { StyleSheet, View } from "react-native";
import { API_URL } from "@/lib/config";
import { colors, space, Text } from "@/ui";

/**
 * The web build is only for testing screens locally: web views need the
 * native app, so show where it would go.
 */
export function WebPage({
  path,
}: {
  path: string;
  onTitle: (t: string) => void;
}) {
  return (
    <View style={styles.center}>
      <Text tone="muted" center>
        {`Web view (native only): ${API_URL}${path}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    backgroundColor: colors.background,
  },
});
