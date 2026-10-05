import type { AppPlatform, LineStatus } from "@contract/admin-members";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Badge, colors } from "@/ui";

/** Account state, colored as on the website (active green, stopped red). */
export function StateBadge({ state, label }: { state: string; label: string }) {
  return (
    <Badge
      label={label}
      tone={
        state === "ACTIVE"
          ? "green"
          : state === "DEACTIVATED" || state === "REJECTED"
            ? "red"
            : "amber"
      }
    />
  );
}

/** Signed in to the native app: one badge per platform (none = no badge). */
export function AppBadges({ platforms }: { platforms?: AppPlatform[] }) {
  const t = useTranslations("adminMembers.badge");
  return (platforms ?? []).map((p) => (
    <Badge
      key={p}
      tone="green"
      label={p === "ios" ? t("appIos") : t("appAndroid")}
    />
  ));
}

/** LINE: green = friend, amber = linked only, grey = not linked. */
export function LineDot({ status }: { status: LineStatus }) {
  return (
    <View
      aria-hidden
      style={[
        styles.dot,
        {
          backgroundColor:
            status === "following"
              ? colors.green600
              : status === "linkedNotFollowing"
                ? colors.amber400
                : colors.slate300,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
});
