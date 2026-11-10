import type {
  AdminMemberDetail,
  AdminSanction,
  AdminSanctionLevel,
} from "@contract/admin-members";
import { Gavel } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { AdminCard, FailedNotice, Notice } from "@/features/admin/parts";
import { DateTimeField } from "@/features/compose/datetime-field";
import { fromJstLocal } from "@/features/compose/jst";
import { confirmAction } from "@/features/me/confirm";
import { Chips } from "@/features/people/choices";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { Badge, Button, colors, Loading, space, Text, TextField } from "@/ui";
import {
  useApplySanction,
  useLiftSanction,
  useMemberSanctions,
} from "./admin-api";

const LEVELS: AdminSanctionLevel[] = [
  "WARNING",
  "RESTRICTED",
  "SUSPENDED",
  "BANNED",
];
/** Levels that end by date (the others: never). */
const DATED: AdminSanctionLevel[] = ["RESTRICTED", "SUSPENDED"];
type Duration = "d7" | "d30" | "d90" | "date" | "none";
const DURATIONS: Duration[] = ["d7", "d30", "d90", "date", "none"];
const DAYS: Partial<Record<Duration, number>> = { d7: 7, d30: 30, d90: 90 };
const REASON_MAX = 1000;

const LEVEL_TONE = {
  WARNING: "amber",
  RESTRICTED: "amber",
  SUSPENDED: "red",
  BANNED: "red",
} as const;

/**
 * 会員詳細 → 処分 (admins): the sanction in force with 解除, applying a new
 * one (警告 / 投稿制限 / 一時停止 / 永久追放, with a duration for the
 * middle two) after a confirmation, and the history. The server lifts the
 * one in force, notifies the member and writes 操作ログ.
 */
export function SanctionsCard({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("mobile.sanction.admin");
  const query = useMemberSanctions(m.id);
  const lift = useLiftSanction(m.id);
  const [done, setDone] = useState<"applied" | "lifted" | null>(null);

  return (
    <AdminCard title={t("title")} icon={Gavel} description={t("description")}>
      {done ? <Notice tone="success">{t(done)}</Notice> : null}
      <FailedNotice error={lift.error} />
      {query.data ? (
        <>
          <View style={styles.part}>
            <Text variant="small" weight="semibold">
              {t("current")}
            </Text>
            {query.data.current ? (
              <Entry
                s={query.data.current}
                lifting={lift.isPending}
                onLift={() => {
                  setDone(null);
                  lift.mutate(query.data.current?.id ?? "", {
                    onSuccess: () => setDone("lifted"),
                  });
                }}
              />
            ) : (
              <Text variant="small" tone="muted">
                {t("none")}
              </Text>
            )}
          </View>
          <View style={[styles.part, styles.divider]}>
            {m.isSelf ? (
              <Text variant="small" tone="muted">
                {t("notSelf")}
              </Text>
            ) : (
              <ApplyForm
                memberId={m.id}
                onApplied={() => setDone("applied")}
                onStart={() => setDone(null)}
              />
            )}
          </View>
          <View style={[styles.part, styles.divider]}>
            <Text variant="small" weight="semibold">
              {t("history")}
            </Text>
            {query.data.history.filter((h) => !h.active).length === 0 ? (
              <Text variant="small" tone="muted">
                {t("noHistory")}
              </Text>
            ) : (
              query.data.history
                .filter((h) => !h.active)
                .map((h) => <Entry key={h.id} s={h} />)
            )}
          </View>
        </>
      ) : query.isError ? (
        <FailedNotice error={query.error} />
      ) : (
        <Loading inline />
      )}
    </AdminCard>
  );
}

/** One sanction: level, status, period, who and when, the reason. */
function Entry({
  s,
  onLift,
  lifting,
}: {
  s: AdminSanction;
  onLift?: () => void;
  lifting?: boolean;
}) {
  const t = useTranslations("mobile.sanction.admin");
  const tl = useTranslations("mobile.sanction.levels");
  const tc = useTranslations("common");
  const { locale } = useAuth();
  const level = tl(s.level);
  const status = s.active
    ? t("active")
    : s.liftedAt
      ? s.liftedBy
        ? t("liftedBy", {
            date: formatDateTime(s.liftedAt, locale),
            name: s.liftedBy,
          })
        : t("liftedAt", { date: formatDateTime(s.liftedAt, locale) })
      : t("ended");
  const lift = async () => {
    const ok = await confirmAction({
      title: t("liftConfirmTitle"),
      message: t("liftConfirm", { level }),
      confirm: t("lift"),
      cancel: tc("cancel"),
    });
    if (ok) onLift?.();
  };
  return (
    <View style={styles.entry}>
      <View style={styles.row}>
        <Badge tone={LEVEL_TONE[s.level]} label={level} />
        <Text variant="caption" tone="muted" style={styles.flex}>
          {status}
        </Text>
      </View>
      {DATED.includes(s.level) ? (
        <Text variant="small">
          {s.endsAt
            ? t("ends", { date: formatDateTime(s.endsAt, locale) })
            : t("indefinite")}
        </Text>
      ) : null}
      <Text variant="small" selectable>
        {s.reason}
      </Text>
      <Text variant="caption" tone="subtle">
        {t("created", {
          date: formatDateTime(s.createdAt, locale),
          name: s.createdBy ?? "—",
        })}
        {s.level === "WARNING" && s.acknowledgedAt
          ? ` · ${t("acknowledged", { date: formatDate(s.acknowledgedAt, locale) })}`
          : ""}
      </Text>
      {onLift ? (
        <Button
          variant="secondary"
          compact
          label={t("lift")}
          accessibilityLabel={t("liftLabel", { level })}
          loading={lifting}
          onPress={() => void lift()}
          style={styles.start}
        />
      ) : null}
    </View>
  );
}

function ApplyForm({
  memberId,
  onApplied,
  onStart,
}: {
  memberId: string;
  onApplied: () => void;
  onStart: () => void;
}) {
  const t = useTranslations("mobile.sanction.admin");
  const tl = useTranslations("mobile.sanction.levels");
  const tc = useTranslations("common");
  const apply = useApplySanction(memberId);
  const [level, setLevel] = useState<AdminSanctionLevel>("WARNING");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<Duration>("d7");
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState<{
    reason?: string;
    endsAt?: string;
  }>({});
  const dated = DATED.includes(level);

  const endsAt = (): string | null | undefined => {
    if (!dated || duration === "none") return null;
    const days = DAYS[duration];
    if (days) return new Date(Date.now() + days * 86_400_000).toISOString();
    const d = fromJstLocal(date);
    return d ? d.toISOString() : undefined;
  };

  const submit = async () => {
    onStart();
    apply.reset();
    const next: typeof errors = {};
    if (!reason.trim()) next.reason = t("reasonRequired");
    const ends = endsAt();
    if (ends === undefined) next.endsAt = t("endsAtRequired");
    else if (ends && new Date(ends).getTime() <= Date.now())
      next.endsAt = t("endsAtPast");
    setErrors(next);
    if (next.reason || next.endsAt || ends === undefined) return;
    const ok = await confirmAction({
      title: t("applyConfirmTitle", { level: tl(level) }),
      message: level === "BANNED" ? t("banConfirm") : t("applyConfirm"),
      confirm: t("apply"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    apply.mutate(
      { level, reason: reason.trim(), endsAt: ends },
      {
        onSuccess: () => {
          setReason("");
          setDate("");
          onApplied();
        },
      },
    );
  };

  const failed =
    apply.error instanceof ApiError && apply.error.code === "not_self"
      ? t("notSelf")
      : apply.error instanceof ApiError && apply.error.code === "invalid"
        ? t("applyFailed")
        : null;

  return (
    <View style={styles.part}>
      <Chips
        label={t("level")}
        choices={LEVELS.map((l) => ({ value: l, label: tl(l) }))}
        value={level}
        onChange={(v) => setLevel(v as AdminSanctionLevel)}
      />
      <Text variant="caption" tone="subtle">
        {t(`levelHints.${level}`)}
      </Text>
      {dated ? (
        <Chips
          label={t("duration")}
          choices={DURATIONS.map((d) => ({
            value: d,
            label: t(`durations.${d}`),
          }))}
          value={duration}
          onChange={(v) => setDuration(v as Duration)}
        />
      ) : null}
      {dated && duration === "date" ? (
        <DateTimeField
          label={t("endsAt")}
          required
          value={date}
          onChange={setDate}
          min={new Date()}
          error={errors.endsAt}
        />
      ) : errors.endsAt ? (
        <Text variant="small" tone="danger">
          {errors.endsAt}
        </Text>
      ) : null}
      <TextField
        label={t("reason")}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={REASON_MAX}
        textAlignVertical="top"
        style={styles.reason}
        error={errors.reason}
        hint={`${reason.length} / ${REASON_MAX}`}
      />
      {failed ? (
        <Notice tone="error">{failed}</Notice>
      ) : (
        <FailedNotice error={apply.error} />
      )}
      <Button
        variant="danger"
        label={t("apply")}
        loading={apply.isPending}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  part: { gap: space.sm },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.md,
  },
  entry: {
    gap: space.xs,
    paddingVertical: space.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  start: { alignSelf: "flex-start" },
  reason: { minHeight: 96 },
});
