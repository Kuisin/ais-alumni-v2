import type { MemberCard, RoleLine } from "@contract/people";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Avatar, Badge, colors, radius, space, Text } from "@/ui";

/** Role badges with their public facts (the website's RoleSummary). */
export function RoleSummary({ roles }: { roles: RoleLine[] }) {
  if (!roles.length) return null;
  return (
    <View style={styles.roles}>
      {roles.map((r) => (
        <View key={r.label} style={styles.role}>
          <Badge label={r.label} tone="brand" />
          {r.facts.length ? (
            <Text variant="small" tone="muted" style={styles.facts}>
              {r.facts.join(" · ")}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Public-tier member summary (src/components/directory/member-card.tsx):
 * the card opens the profile unless `onPress` is left out (e.g. blocked
 * members); `actions` sit below, outside the tap target.
 */
export function MemberCardView({
  member,
  onPress,
  meta,
  actions,
}: {
  member: MemberCard;
  onPress?: () => void;
  meta?: string | null;
  actions?: ReactNode;
}) {
  const tp = useTranslations("profile");
  const body = (
    <>
      <Avatar uri={member.avatar} size={48} />
      <View style={styles.text}>
        <Text weight="semibold" numberOfLines={1}>
          {member.name}
        </Text>
        {member.otherName ? (
          <Text variant="small" tone="subtle" numberOfLines={1}>
            {member.otherName}
          </Text>
        ) : null}
        {member.nameAtAis ? (
          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {tp("nameAtAisValue", { name: member.nameAtAis })}
          </Text>
        ) : null}
        <RoleSummary roles={member.roles} />
        {meta ? (
          <Text variant="caption" tone="subtle">
            {meta}
          </Text>
        ) : null}
      </View>
    </>
  );
  return (
    <View style={styles.card}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            member.otherName
              ? `${member.name}, ${member.otherName}`
              : member.name
          }
          onPress={onPress}
          style={({ pressed }) => [
            styles.main,
            pressed ? styles.pressed : null,
          ]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.main}>{body}</View>
      )}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  main: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    padding: space.md,
  },
  pressed: { backgroundColor: colors.slate50 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  roles: { gap: space.xs, marginTop: space.xs },
  role: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: space.sm,
    rowGap: 2,
  },
  facts: { flexShrink: 1 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    // Line up with the text column (48 pt photo + gap).
    paddingLeft: space.md + 48 + space.md,
  },
});
