import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useMe } from "@/lib/auth";
import { CountDot, colors, TOUCH } from "@/ui";

/** Home's header button to お知らせ, with the unseen count. */
export function InboxBell() {
  const t = useTranslations("mobile.inbox");
  const router = useRouter();
  const unread = useMe().badges.inbox;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? t("bellUnread", { count: unread }) : t("bell")
      }
      hitSlop={4}
      onPress={() => router.push("/notifications")}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <Bell color={colors.slate700} size={22} aria-hidden />
      {unread > 0 ? (
        <View style={styles.dot} pointerEvents="none">
          <CountDot count={unread} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: TOUCH / 2,
  },
  pressed: { backgroundColor: colors.slate100 },
  dot: { position: "absolute", top: 2, right: 0 },
});
