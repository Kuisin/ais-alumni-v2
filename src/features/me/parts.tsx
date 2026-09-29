import type { Reach } from "@contract/account";
import { Check, Lock, Pencil, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button, Card, colors, radius, space, Text } from "@/ui";

/**
 * Pieces of the マイページ and 設定 screens, shaped like the website's
 * EditableCard / SettingsSection: a card with its title, the website's
 * edit button (which opens that section of the website), and label /
 * value rows with their 「公開範囲」.
 */

export function SectionCard({
  title,
  icon,
  description,
  action,
  tone = "default",
  children,
}: {
  title: string;
  icon?: ReactNode;
  description?: string | null;
  /** e.g. 編集 / 変更を申請 → the website's form */
  action?: { label: string; onPress: () => void } | null;
  tone?: "default" | "danger";
  children?: ReactNode;
}) {
  return (
    <Card style={tone === "danger" ? styles.danger : styles.card}>
      <View style={styles.head}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text
          variant="subheading"
          accessibilityRole="header"
          style={[styles.title, tone === "danger" ? styles.dangerText : null]}
        >
          {title}
        </Text>
        {action ? (
          <EditButton label={action.label} onPress={action.onPress} />
        ) : null}
      </View>
      {description ? (
        <Text variant="small" tone="muted">
          {description}
        </Text>
      ) : null}
      {children}
    </Card>
  );
}

/** The website's secondary 編集 button (36 pt, 44 pt with its hit slop). */
export function EditButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      variant="secondary"
      compact
      label={label}
      hitSlop={4}
      icon={(c) => <Pencil color={c} size={14} aria-hidden />}
      onPress={onPress}
    />
  );
}

/** A label / value row (the website's <Row>), with who sees it. */
export function Field({
  label,
  reach,
  children,
}: {
  label: string;
  reach?: Reach;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      {typeof children === "string" ? (
        <Text selectable>{children}</Text>
      ) : (
        children
      )}
      {reach ? <ReachTag reach={reach} /> : null}
    </View>
  );
}

export function Fields({ children }: { children: ReactNode }) {
  return <View style={styles.fields}>{children}</View>;
}

/** Amber hint box (the website's bg-amber-50 notes). */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text variant="small" style={styles.noticeText}>
        {children}
      </Text>
    </View>
  );
}

/** Nested audiences, as in the website's src/lib/profile-visibility.ts. */
const AUDIENCES = ["members", "followers", "family"] as const;
const RANK: Record<Reach, number> = {
  members: 0,
  followers: 1,
  family: 2,
  self: 3,
};

/**
 * 「公開範囲」 chips: one per audience (会員全員 / フォロワー / 家族), ticked
 * when that audience sees the field; "self" = only you and the committee.
 * Never colour alone: each chip has ✓ / ✕ and a spoken state.
 */
export function ReachTag({ reach }: { reach: Reach }) {
  const t = useTranslations("profile.visibility");
  if (reach === "self")
    return (
      <View style={styles.chips}>
        <View style={[styles.chip, styles.chipOff]}>
          <Lock size={12} color={colors.slate700} aria-hidden />
          <Text variant="caption" weight="medium" style={styles.chipSelf}>
            {t("onlyYou")}
          </Text>
        </View>
      </View>
    );
  return (
    <View style={styles.chips}>
      {AUDIENCES.map((a) => {
        const shown = RANK[a] >= RANK[reach];
        const Icon = shown ? Check : X;
        const label = t(`audiences.${a}`);
        return (
          <View
            key={a}
            accessible
            accessibilityLabel={`${label}: ${shown ? t("shown") : t("hidden")}`}
            style={[styles.chip, shown ? styles.chipOn : styles.chipOff]}
          >
            <Icon
              size={12}
              color={shown ? colors.green700 : colors.slate500}
              aria-hidden
            />
            <Text
              variant="caption"
              weight="medium"
              style={shown ? styles.chipOnText : styles.chipOffText}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  danger: {
    gap: space.md,
    borderColor: colors.red100,
    backgroundColor: colors.red50,
  },
  dangerText: { color: colors.red700 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 36,
  },
  icon: { alignItems: "center", justifyContent: "center" },
  title: { flex: 1 },
  fields: { gap: space.md },
  field: { gap: 2 },
  notice: {
    backgroundColor: colors.amber50,
    borderRadius: radius.md,
    padding: space.md,
  },
  noticeText: { color: colors.amber900 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    marginTop: space.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  chipOn: { backgroundColor: colors.green50 },
  chipOff: { backgroundColor: colors.slate100 },
  chipOnText: { color: colors.green700 },
  chipOffText: { color: colors.slate500 },
  chipSelf: { color: colors.slate700 },
});
