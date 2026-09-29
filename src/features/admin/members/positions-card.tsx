import type {
  AdminMemberDetail,
  AdminMemberPosition,
} from "@contract/admin-members";
import { BadgeCheck } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { confirmAction } from "@/features/me/confirm";
import { Badge, Button, colors, radius, space, Text } from "@/ui";
import { Actions, AdminCard, FailedNotice, Notice, Picker } from "../parts";
import { useSetPosition } from "./api";

/** 役職: each position, whether it's held, and 任命 / 更新 / 解除. */
export function PositionsCard({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers.positions");
  return (
    <AdminCard title={t("title")} icon={BadgeCheck}>
      {m.positions.map((p) => (
        <PositionControl key={p.position} userId={m.id} p={p} />
      ))}
    </AdminCard>
  );
}

function PositionControl({
  userId,
  p,
}: {
  userId: string;
  p: AdminMemberPosition;
}) {
  const t = useTranslations("adminMembers.positions");
  const tc = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [cohort, setCohort] = useState(
    String(p.cohortNumber ?? p.defaultCohortNumber ?? ""),
  );
  const set = useSetPosition(userId);
  const needsCohort = p.position === "STUDENT_LEADER";
  const done = set.data?.ok ? set.data.message : null;
  const failed = set.data && !set.data.ok ? set.data.message : null;

  const send = async (grant: boolean) => {
    if (!grant) {
      const ok = await confirmAction({
        title: t("removeConfirm"),
        confirm: t("remove"),
        cancel: tc("cancel"),
        destructive: true,
      });
      if (!ok) return;
    }
    const res = await set
      .mutateAsync({ position: p.position, grant, cohortNumber: cohort })
      .catch(() => null);
    if (res?.ok) setEditing(false);
  };

  return (
    <View style={styles.box}>
      <View style={styles.title}>
        <Text weight="semibold">{t(`names.${p.position}`)}</Text>
        {p.held ? (
          <Badge
            tone="green"
            label={
              needsCohort && p.cohortNumber
                ? t("heldCohort", {
                    cohort:
                      p.cohorts.find((c) => c.value === String(p.cohortNumber))
                        ?.label ?? "—",
                  })
                : t("held")
            }
          />
        ) : null}
      </View>
      <Text variant="small" tone="muted">
        {t(`descriptions.${p.position}`)}
      </Text>
      {!p.eligible && !p.held && t(`requires.${p.position}`) ? (
        <Text variant="small" style={{ color: colors.amber800 }}>
          {t(`requires.${p.position}`)}
        </Text>
      ) : null}
      {done ? <Notice tone="success">{t(done)}</Notice> : null}
      {failed ? <Notice tone="error">{t(failed)}</Notice> : null}
      <FailedNotice error={set.error} />
      {editing ? (
        <View style={styles.form}>
          {needsCohort ? (
            <Picker
              label={t("cohort")}
              choices={[{ value: "", label: "—" }, ...p.cohorts]}
              value={cohort}
              onChange={setCohort}
            />
          ) : null}
          <Actions>
            {p.eligible ? (
              <Button
                label={p.held ? t("update") : t("grant")}
                loading={set.isPending}
                onPress={() => send(true)}
              />
            ) : null}
            {p.held ? (
              <Button
                label={t("remove")}
                variant="secondary"
                disabled={set.isPending}
                onPress={() => send(false)}
              />
            ) : null}
            <Button
              label={tc("cancel")}
              variant="ghost"
              onPress={() => setEditing(false)}
            />
          </Actions>
        </View>
      ) : p.eligible || p.held ? (
        <Actions>
          <Button
            label={p.held ? tc("edit") : t("grant")}
            variant="secondary"
            compact
            onPress={() => {
              set.reset();
              setEditing(true);
            }}
          />
        </Actions>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  title: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  form: { gap: space.md },
});
