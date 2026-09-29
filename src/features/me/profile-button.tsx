import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useMe } from "@/lib/auth";
import { Avatar, CountDot, colors, space, TOUCH } from "@/ui";

/**
 * The header's top-left button to マイページ: the member's photo, with the
 * number of follow requests waiting (what the Me tab's badge used to show).
 */
export function ProfileButton() {
  const t = useTranslations("common.nav");
  const tf = useTranslations("dashboard.todo");
  const router = useRouter();
  const me = useMe();
  const waiting = me.badges.follows;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        waiting > 0
          ? `${t("profileShort")}, ${tf("followRequests", { count: waiting })}`
          : t("profileShort")
      }
      hitSlop={4}
      onPress={() => router.push("/me")}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <Avatar uri={me.user.avatar} size={32} />
      {waiting > 0 ? (
        <View style={styles.dot}>
          <CountDot count={waiting} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH,
    height: TOUCH,
    marginLeft: space.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: TOUCH / 2,
  },
  pressed: { backgroundColor: colors.slate100 },
  dot: { pointerEvents: "none", position: "absolute", top: 0, right: -4 },
});
