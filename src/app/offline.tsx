import { WifiOff } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { Button, colors, space, Text } from "@/ui";

/** Signed in, but the server can't be reached right now. */
export default function OfflineScreen() {
  const t = useTranslations("mobile.errors");
  const tc = useTranslations("common");
  const { refreshMe, signOut } = useAuth();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <WifiOff size={40} color={colors.slate400} />
        <Text variant="subheading" center>
          {t("unreachable.title")}
        </Text>
        <Text tone="muted" center>
          {t("unreachable.body")}
        </Text>
        <Button label={t("retry")} onPress={refreshMe} />
        <Button variant="ghost" label={tc("signOut")} onPress={signOut} />
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
