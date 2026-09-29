import type {
  RecordField,
  RecordPage,
  RecordRequestView,
  RecordRole,
} from "@contract/profile";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { Pencil, X } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  colors,
  QueryState,
  radius,
  Screen,
  space,
  Text,
  TextField,
} from "@/ui";
import { profileApi, RECORD_KEY, useProfileForm, useRecordPage } from "./api";
import { FormMessage, SelectSheet } from "./form-parts";

const STATUS_TONE = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "slate",
} as const;

/**
 * 在籍情報の修正依頼 (the website's /app/profile/record): each role's AIS
 * record, a pending request (with withdraw) or the correction form, and
 * past requests.
 */
export function RecordScreen() {
  const t = useTranslations("records");
  const query = useRecordPage();
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {(page) => (
          <Screen
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
          >
            <Text variant="small" tone="muted">
              {t("description")}
            </Text>
            {page.roles.length === 0 ? (
              <Card>
                <Text>{t("noRecord")}</Text>
              </Card>
            ) : null}
            {page.roles.map((r) => (
              <RoleCard key={r.role} role={r} cohorts={page.cohorts} />
            ))}
            {page.history.length ? <PastRequests list={page.history} /> : null}
          </Screen>
        )}
      </QueryState>
    </>
  );
}

function RoleCard({
  role,
  cohorts,
}: {
  role: RecordRole;
  cohorts: RecordPage["cohorts"];
}) {
  const t = useTranslations("records");
  const [open, setOpen] = useState(false);
  return (
    <Card style={styles.card}>
      <Text variant="subheading" accessibilityRole="header">
        {role.label}
      </Text>
      <View style={styles.rows}>
        {role.rows.map((row) => (
          <View key={row.field} style={styles.pair}>
            <Text variant="small" tone="muted" style={styles.pairLabel}>
              {row.stillTeaching
                ? t("fields.employment")
                : t(`fields.${row.field}`)}
            </Text>
            <View style={styles.pairValue}>
              {row.stillTeaching ? (
                <Badge tone="green" label={t("stillTeaching")} />
              ) : (
                <Text variant="small" selectable>
                  {row.value}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {role.pending ? (
        <PendingRequest request={role.pending} />
      ) : open ? (
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text weight="semibold" style={styles.flex}>
              {t("requestCorrection")}
            </Text>
            <Button
              variant="ghost"
              compact
              label={t("close")}
              icon={(c) => <X color={c} size={16} aria-hidden />}
              onPress={() => setOpen(false)}
            />
          </View>
          <RequestForm role={role} cohorts={cohorts} />
        </View>
      ) : (
        <Button
          variant="secondary"
          label={t("requestCorrection")}
          icon={(c) => <Pencil color={c} size={16} aria-hidden />}
          onPress={() => setOpen(true)}
        />
      )}
    </Card>
  );
}

function Diff({ rows }: { rows: RecordRequestView["diff"] }) {
  const t = useTranslations("records");
  return (
    <View style={styles.diff}>
      {rows.map((d) => (
        <View key={d.field} style={styles.diffRow}>
          <Text variant="small" tone="muted">
            {t(`fields.${d.field}`)}
          </Text>
          <Text variant="small">
            <Text variant="small" tone="subtle" style={styles.strike}>
              {d.current}
            </Text>
            {"  →  "}
            <Text variant="small" weight="semibold" tone="brand">
              {d.proposed}
            </Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

function PendingRequest({ request }: { request: RecordRequestView }) {
  const t = useTranslations("records");
  const { locale } = useAuth();
  const { mutation } = useProfileForm(profileApi.withdrawRecord);
  const queryClient = useQueryClient();
  return (
    <View style={styles.pending}>
      <Text weight="medium" style={styles.pendingText}>
        {t("pending", { date: formatDate(request.createdAt, locale) })}
      </Text>
      <Diff rows={request.diff} />
      <Text variant="small">
        <Text variant="small" weight="medium">{`${t("reason")}: `}</Text>
        {request.reason}
      </Text>
      <Button
        variant="secondary"
        compact
        label={t("cancel")}
        loading={mutation.isPending}
        style={styles.start}
        onPress={() =>
          mutation.mutate(request.id, {
            onSuccess: () =>
              queryClient.invalidateQueries({ queryKey: RECORD_KEY }),
          })
        }
      />
    </View>
  );
}

const YEAR_FIELDS = new Set<RecordField>(["yearsFrom", "yearsTo"]);

function RequestForm({
  role,
  cohorts,
}: {
  role: RecordRole;
  cohorts: RecordPage["cohorts"];
}) {
  const t = useTranslations("records");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [values, setValues] = useState(role.values);
  const [reason, setReason] = useState("");
  const { mutation, status, fieldError } = useProfileForm(
    profileApi.recordRequest,
    () => queryClient.invalidateQueries({ queryKey: RECORD_KEY }),
  );
  const err = (f: string) => {
    const code = fieldError(f);
    return code ? t(`fieldErrors.${code}`) : null;
  };
  const set = (f: RecordField) => (v: string) =>
    setValues((s) => ({ ...s, [f]: v }));

  return (
    <View style={styles.form}>
      {role.fields.map((f) =>
        f === "cohort" ? (
          <SelectSheet
            key={f}
            label={t(`fields.${f}`)}
            choices={[
              { value: "", label: "—" },
              ...cohorts.map((c) => ({
                value: c.value,
                label: c.graduated
                  ? c.label
                  : `${c.label} · ${t("cohortCurrent")}`,
              })),
            ]}
            value={values[f] ?? ""}
            onChange={set(f)}
            error={err(f)}
          />
        ) : (
          <TextField
            key={f}
            label={t(`fields.${f}`)}
            hint={
              f === "yearsTo"
                ? t(
                    role.role === "TEACHER"
                      ? "hints.teacherYearsTo"
                      : "hints.studentYearsTo",
                  )
                : undefined
            }
            error={err(f)}
            value={values[f] ?? ""}
            onChangeText={set(f)}
            {...(YEAR_FIELDS.has(f)
              ? {
                  keyboardType: "number-pad" as const,
                  maxLength: 4,
                  placeholder: t("yearPlaceholder"),
                }
              : { maxLength: f === "subjects" ? 300 : 50 })}
          />
        ),
      )}
      <TextField
        label={`${t("reason")} *`}
        hint={t("hints.reason")}
        error={err("reason")}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={1000}
        style={styles.textarea}
        textAlignVertical="top"
      />
      <FormMessage status={status} t={t} />
      <Button
        label={mutation.isPending ? tc("saving") : t("submit")}
        loading={mutation.isPending}
        onPress={() => mutation.mutate({ role: role.role, values, reason })}
      />
    </View>
  );
}

function PastRequests({ list }: { list: RecordRequestView[] }) {
  const t = useTranslations("records");
  const { locale } = useAuth();
  return (
    <Card style={styles.card}>
      <Text variant="subheading" accessibilityRole="header">
        {t("history")}
      </Text>
      {list.map((q, i) => (
        <View
          key={q.id}
          style={[styles.past, i > 0 ? styles.pastBorder : null]}
        >
          <View style={styles.badges}>
            <Badge
              tone={STATUS_TONE[q.status]}
              label={t(`status.${q.status}`)}
            />
            <Text variant="small">{q.roleLabel}</Text>
            <Text variant="small" tone="subtle">
              {formatDate(q.createdAt, locale)}
            </Text>
          </View>
          <Diff rows={q.diff} />
          {q.reviewNote ? (
            <Text variant="small">
              <Text
                variant="small"
                weight="medium"
              >{`${t("reviewNote")}: `}</Text>
              {q.reviewNote}
            </Text>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space.md },
  rows: { gap: space.xs },
  pair: { flexDirection: "row", gap: space.lg, alignItems: "center" },
  pairLabel: { width: 112 },
  pairValue: { flex: 1, alignItems: "flex-start" },
  panel: {
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: space.md,
  },
  panelHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  form: { gap: space.md },
  textarea: { minHeight: 72 },
  pending: {
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.amber100,
    backgroundColor: colors.amber50,
    borderRadius: radius.md,
    padding: space.md,
  },
  pendingText: { color: colors.amber900 },
  start: { alignSelf: "flex-start" },
  diff: { gap: space.xs },
  diffRow: { gap: 2 },
  strike: { textDecorationLine: "line-through" },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  past: { gap: space.sm, paddingTop: space.sm },
  pastBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
