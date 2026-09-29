import type { VerificationQueueItem } from "@contract/admin";
import {
  ChevronRight,
  FileText,
  GraduationCap,
  ListChecks,
  MailPlus,
  ShieldCheck,
  UserCheck,
} from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, space, Text } from "@/ui";
import { Chips, Signal } from "./parts";

/** One application in the queue: who, when, and the review signals. */
export function QueueRow({
  item: r,
  onPress,
}: {
  item: VerificationQueueItem;
  onPress: () => void;
}) {
  const t = useTranslations("adminVerify");
  const ti = useTranslations("adminVerify.invite");
  const tr = useTranslations("roles");
  const roles = r.roles.map((role) => tr(`role.${role}`)).join(" · ");
  const v = r.vouches;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.name}, ${r.submittedDate}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={styles.who}>
            <Text weight="semibold">
              {r.name}
              {roles ? (
                <Text variant="small" tone="muted">
                  {`  ${roles}`}
                </Text>
              ) : null}
            </Text>
            {r.registeredBy ? (
              <Text variant="small" tone="muted">
                {t("queue.registeredBy", { name: r.registeredBy })}
              </Text>
            ) : null}
            {r.children ? (
              <Text variant="small" tone="muted">
                {t("queue.children", { names: r.children })}
              </Text>
            ) : null}
          </View>
          <Text variant="caption" tone="subtle">
            {r.submittedDate}
            <Text variant="caption" weight="medium" tone="muted">
              {`  ${r.age}`}
            </Text>
          </Text>
        </View>
        <Chips>
          {r.invite ? (
            <Signal
              tone={r.invite.mismatch ? "amber" : "green"}
              icon={MailPlus}
              label={
                r.invite.grade
                  ? ti("badgeGrade")
                  : `${t("badges.invited")} · ${ti("badgeIndividual")}`
              }
            />
          ) : null}
          <Signal
            tone={
              r.rosterScore === null ? "dim" : r.rosterMatch ? "green" : "amber"
            }
            icon={ListChecks}
            label={
              r.rosterScore === null
                ? t("badges.noRoster")
                : r.rosterMatch
                  ? t("badges.rosterMatch", { score: r.rosterScore })
                  : t("badges.roster", { score: r.rosterScore })
            }
          />
          <Signal
            tone={
              v.no > 0 ? "red" : v.yes > 0 ? "green" : v.total ? "amber" : "dim"
            }
            icon={UserCheck}
            label={
              v.total
                ? t("badges.vouchCounts", {
                    yes: v.yes,
                    no: v.no,
                    unsure: v.unsure,
                    pending: v.pending,
                  })
                : t("badges.noVouches")
            }
          />
          {r.diploma ? (
            <Signal
              tone="green"
              icon={GraduationCap}
              label={t("badges.diploma")}
            />
          ) : null}
          <Signal
            tone={r.evidence > 0 ? "blue" : "dim"}
            icon={FileText}
            label={t("badges.evidence", { count: r.evidence })}
          />
          {r.schoolEmail ? (
            <Signal
              tone="green"
              icon={ShieldCheck}
              label={t("badges.schoolEmail")}
            />
          ) : null}
          {r.minor ? <Signal tone="amber" label={t("badges.minor")} /> : null}
          {r.minor ? (
            r.parentConfirmed ? (
              <Signal tone="green" label={t("badges.parentConfirmed")} />
            ) : (
              <Signal tone="red" label={t("badges.parentUnconfirmed")} />
            )
          ) : null}
        </Chips>
      </View>
      <ChevronRight size={18} color={colors.slate400} aria-hidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.slate100 },
  body: { flex: 1, gap: space.sm },
  head: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "baseline",
    columnGap: space.md,
    rowGap: 2,
  },
  who: { flexShrink: 1, gap: 2 },
});
