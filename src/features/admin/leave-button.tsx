import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import { colors, Text, TOUCH } from "@/ui";

/**
 * 管理モード home's top-left: back to where the member came from (the
 * website's 「会員画面」 switch). Admin mode is its own stack, so its first
 * screen has no back button of its own.
 */
export function LeaveAdminButton() {
  const t = useTranslations("common.nav");
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("memberMode")}
      hitSlop={4}
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace("/home")
      }
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <ChevronLeft color={colors.brand700} size={22} aria-hidden />
      <Text variant="small" tone="brand" weight="medium">
        {t("memberModeShort")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
    borderRadius: 8,
  },
  pressed: { backgroundColor: colors.slate100 },
});
