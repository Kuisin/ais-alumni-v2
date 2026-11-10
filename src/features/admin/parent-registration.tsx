import type { ParentRegistration } from "@contract/admin";
import { useRouter } from "expo-router";
import { ChevronRight, UsersRound } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, radius, space, Text } from "@/ui";

/**
 * 「保護者が登録」: a student account a parent created at sign-up — who, and
 * whether the parent still manages it (保護者が管理中) or it was handed over
 * (本人に引き継ぎ済み). Opens the parent's page in 管理モード.
 */
export function ParentRegisteredBadge({
  registration: r,
}: {
  registration: ParentRegistration;
}) {
  const t = useTranslations("mobile.parentRegistered");
  const router = useRouter();
  const state = r.managed ? t("managed") : t("handedOver");
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t("a11y", { name: r.parentName, state })}
      hitSlop={6}
      onPress={() =>
        router.push({
          pathname: "/admin/members/[id]",
          params: { id: r.parentId },
        })
      }
      style={({ pressed }) => [styles.badge, pressed ? styles.pressed : null]}
    >
      <UsersRound size={14} color={colors.amber900} aria-hidden />
      <Text variant="caption" weight="semibold" style={styles.label}>
        {t("by", { name: r.parentName })}
      </Text>
      <View style={[styles.state, r.managed ? null : styles.stateDone]}>
        <Text
          variant="caption"
          weight="medium"
          style={r.managed ? styles.stateText : styles.stateDoneText}
        >
          {state}
        </Text>
      </View>
      <ChevronRight size={14} color={colors.amber900} aria-hidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.xs,
    minHeight: 32,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amber400,
    backgroundColor: colors.amber50,
  },
  pressed: { backgroundColor: colors.amber100 },
  label: { color: colors.amber900 },
  state: {
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    backgroundColor: colors.amber100,
  },
  stateDone: { backgroundColor: colors.green100 },
  stateText: { color: colors.amber900 },
  stateDoneText: { color: colors.green700 },
});
