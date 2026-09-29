import type { OnboardingLine } from "@contract/onboarding";
import * as Linking from "expo-linking";
import { Clock, MessageCircle } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { LineOutcomeNotice } from "@/features/line/outcome-notice";
import { useLineLinkReturn, useLinkLine } from "@/features/line/use-link-line";
import { Button, colors, radius, space, Text } from "@/ui";

/**
 * The website's LineLinkPanel for onboarding: not linked → 「LINE を連携
 * する」 (native flow, src/features/line); linked but not following → add
 * the Official Account as a friend; linked and following → done.
 * `returnTo` is this screen's web path (the web round trip returns there).
 */
export function LinePanel({
  line,
  returnTo,
  onChanged,
}: {
  line: OnboardingLine;
  returnTo: string;
  /** reload after linking or adding the friend */
  onChanged: () => void;
}) {
  const t = useTranslations("line");
  const link = useLinkLine(returnTo);
  const back = useLineLinkReturn();
  const outcome = link.data ?? back;

  if (line.linked && line.following)
    return (
      <View style={styles.gap}>
        <LineOutcomeNotice outcome={outcome} />
        <View style={styles.row}>
          <View style={styles.dot} />
          <Text variant="small" style={styles.flex}>
            {line.displayName
              ? t("panel.linkedFollowingAs", { name: line.displayName })
              : t("panel.linkedFollowing")}
          </Text>
        </View>
      </View>
    );

  if (line.linked)
    return (
      <View style={styles.gap}>
        <LineOutcomeNotice outcome={outcome} />
        <Text variant="small">
          {line.displayName
            ? t("panel.linkedNotFollowingAs", { name: line.displayName })
            : t("panel.linkedNotFollowing")}
        </Text>
        {line.addFriendUrl ? (
          <Button
            variant="line"
            label={t("addFriend")}
            icon={(c) => <MessageCircle color={c} size={18} />}
            onPress={() => {
              if (line.addFriendUrl) void Linking.openURL(line.addFriendUrl);
            }}
          />
        ) : null}
        <Button
          variant="ghost"
          compact
          label={t("panel.refresh")}
          onPress={onChanged}
        />
      </View>
    );

  if (!line.ready)
    return (
      <View style={styles.notReady}>
        <Clock size={16} color={colors.amber900} aria-hidden />
        <Text variant="small" style={[styles.flex, { color: colors.amber900 }]}>
          {t("panel.notReady")}
        </Text>
      </View>
    );

  return (
    <View style={styles.gap}>
      <LineOutcomeNotice outcome={outcome} />
      {link.error ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {t("outcome.error")}
        </Text>
      ) : null}
      <Button
        variant="line"
        label={t("linkButton")}
        loading={link.isPending}
        icon={(c) => <MessageCircle color={c} size={18} />}
        onPress={() =>
          link.mutate(undefined, {
            onSuccess: (o) => {
              if (o && o !== "cancelled") onChanged();
            },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.line,
  },
  notReady: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.amber50,
    borderRadius: radius.md,
    padding: space.md,
  },
});
