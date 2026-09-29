import type {
  AdminMemberDetail,
  AdminMemberRole,
  AdminResult,
  AdminRoleUpdate,
  RoleKeyName,
} from "@contract/admin-members";
import { ChevronRight, GraduationCap, Plus } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { confirmAction } from "@/features/me/confirm";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Button, colors, radius, space, Text, TextField, TOUCH } from "@/ui";
import {
  Actions,
  AdminCard,
  FailedNotice,
  Notice,
  Picker,
  ResultNotice,
} from "../parts";
import { useRemoveRole, useSaveRole } from "./api";

type Choice = { value: string; label: string };
type Inputs = Omit<AdminRoleUpdate, "role">;

const STUDENT: RoleKeyName[] = ["CURRENT_STUDENT", "FORMER_STUDENT"];
const s = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

/**
 * 区分: each role (open to see its 在籍記録, edit or remove it) and adding a
 * role the member doesn't have — the website's MemberRoleForm / AddRoleForm.
 * Current vs former, grade and graduation are computed and shown read-only.
 */
export function RolesCard({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers.roles");
  const [removed, setRemoved] = useState<AdminResult | null>(null);
  return (
    <AdminCard title={t("title")} icon={GraduationCap}>
      <ResultNotice result={removed} />
      {m.roles.length === 0 ? (
        <Text variant="small" tone="muted">
          {t("none")}
        </Text>
      ) : null}
      {m.roles.map((r) => (
        <RoleRow
          key={r.role}
          m={m}
          r={r}
          startOpen={m.roles.length === 1}
          onRemoved={setRemoved}
        />
      ))}
      {m.addableRoles.length ? <AddRole m={m} /> : null}
    </AdminCard>
  );
}

function Disclosure({
  title,
  open,
  onToggle,
  add,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  add?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onToggle}
      style={({ pressed }) => [styles.summary, pressed ? styles.pressed : null]}
    >
      {add ? (
        <Plus size={16} color={colors.brand700} aria-hidden />
      ) : (
        <ChevronRight
          size={16}
          color={colors.slate400}
          aria-hidden
          style={open ? styles.rotate : undefined}
        />
      )}
      <Text
        weight="medium"
        tone={add ? "brand" : "default"}
        style={styles.flex}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function RoleRow({
  m,
  r,
  startOpen,
  onRemoved,
}: {
  m: AdminMemberDetail;
  r: AdminMemberRole;
  startOpen: boolean;
  onRemoved: (r: AdminResult) => void;
}) {
  const t = useTranslations("adminMembers.roles");
  const tc = useTranslations("common");
  const { locale } = useAuth();
  const [open, setOpen] = useState(startOpen);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<AdminResult | null>(null);
  const remove = useRemoveRole(m.id);

  const onRemove = async () => {
    const ok = await confirmAction({
      title: t("removeConfirm"),
      confirm: t("remove"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    const res = await remove.mutateAsync(r.role).catch(() => null);
    if (res?.ok) onRemoved(res);
  };

  return (
    <View style={styles.box}>
      <Disclosure title={r.title} open={open} onToggle={() => setOpen(!open)} />
      {open ? (
        <View style={styles.body}>
          {r.stageUpdatedAt ? (
            <Text variant="caption" tone="subtle">
              {t("stageUpdatedAt", {
                date: formatDate(r.stageUpdatedAt, locale),
              })}
            </Text>
          ) : null}
          {editing ? (
            <RoleForm
              m={m}
              role={r.role}
              r={r}
              onDone={(res) => {
                setSaved(res);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <ResultNotice result={saved} />
              <View style={styles.record}>
                <Text variant="small" weight="semibold">
                  {r.label}
                </Text>
                {r.facts.length ? (
                  <Text variant="small" tone="muted">
                    {r.facts.join(" · ")}
                  </Text>
                ) : null}
                {r.subjects ? (
                  <Text variant="small" tone="muted">
                    {t("subjects")}: {r.subjects}
                  </Text>
                ) : null}
              </View>
              <Actions>
                <Button
                  label={tc("edit")}
                  variant="secondary"
                  compact
                  onPress={() => {
                    setSaved(null);
                    setEditing(true);
                  }}
                />
                <Button
                  label={t("remove")}
                  variant="ghost"
                  compact
                  loading={remove.isPending}
                  onPress={onRemove}
                />
              </Actions>
              <ResultNotice result={remove.data?.ok ? null : remove.data} />
              <FailedNotice error={remove.error} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function AddRole({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers.roles");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<RoleKeyName | "">("");
  const [done, setDone] = useState<AdminResult | null>(null);
  return (
    <View style={[styles.box, styles.dashed]}>
      <Disclosure
        title={t("addTitle")}
        open={open}
        onToggle={() => setOpen(!open)}
        add
      />
      {open ? (
        <View style={styles.body}>
          <ResultNotice result={done} />
          <Picker
            label={t("addRole")}
            choices={[
              { value: "", label: "—" },
              ...m.addableRoles.map((r) => ({
                value: r,
                label: t(`addTypes.${r}`),
              })),
            ]}
            value={role}
            onChange={(v) => {
              setDone(null);
              setRole(v as RoleKeyName | "");
            }}
          />
          {role ? (
            <RoleForm
              key={role}
              m={m}
              role={role}
              onDone={(res) => {
                setDone(res);
                setRole("");
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** One role's inputs (RoleFields on the website) and its save button. */
function RoleForm({
  m,
  role,
  r,
  onDone,
  onCancel,
}: {
  m: AdminMemberDetail;
  role: RoleKeyName;
  /** editing an existing role */
  r?: AdminMemberRole;
  onDone: (res: AdminResult) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("adminMembers.roles");
  const tc = useTranslations("common");
  const v = r?.values;
  const [x, setX] = useState<Inputs>({
    cohortNumber: s(v?.cohortNumber),
    yearsFrom: s(v?.yearsFrom),
    yearsTo: s(v?.yearsTo),
    subjects: s(v?.subjects),
    schoolEmail: s(v?.schoolEmail),
    studentIdNo: s(v?.studentIdNo),
  });
  const save = useSaveRole(m.id);
  const fe = save.data?.fieldErrors;
  const set = (k: keyof Inputs) => (text: string) =>
    setX((p) => ({ ...p, [k]: text }));
  const year = (k: "yearsFrom" | "yearsTo", label: string, hint?: string) => (
    <TextField
      label={label}
      hint={hint}
      value={x[k]}
      onChangeText={set(k)}
      keyboardType="number-pad"
      maxLength={4}
    />
  );
  const submit = async () => {
    const res = await save.mutateAsync({ role, ...x }).catch(() => null);
    if (res?.ok) onDone(res);
  };

  let fields: ReactNode;
  if (role === "TEACHER") {
    const emailError = fe?.schoolEmail
      ? t(
          [
            "schoolEmailDomain",
            "schoolEmailRequired",
            "schoolEmailTaken",
          ].includes(fe.schoolEmail)
            ? fe.schoolEmail
            : "schoolEmailInvalid",
        )
      : null;
    fields = (
      <>
        {r?.derived ? <Derived text={r.derived} /> : null}
        {year("yearsFrom", t("joinedYear"))}
        {year("yearsTo", t("leftYear"), t("leftYearTeacherHint"))}
        <TextField
          label={t("subjects")}
          value={x.subjects}
          onChangeText={set("subjects")}
          maxLength={200}
        />
        <TextField
          label={t("schoolEmail")}
          hint={
            v?.schoolEmailVerified
              ? t("schoolEmailVerified")
              : t("schoolEmailHint")
          }
          value={x.schoolEmail}
          onChangeText={set("schoolEmail")}
          placeholder="name@aisnagoya.net"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={emailError}
        />
      </>
    );
  } else if (STUDENT.includes(role)) {
    const cohorts: Choice[] = [
      { value: "", label: t("unknown") },
      ...m.cohorts,
    ];
    fields = (
      <>
        {r?.derived ? <Derived text={r.derived} /> : null}
        <Picker
          label={t("cohort")}
          choices={cohorts}
          value={x.cohortNumber}
          onChange={set("cohortNumber")}
        />
        {year("yearsFrom", t("joinedYear"))}
        {year("yearsTo", t("leftYear"), t("leftYearStudentHint"))}
        <TextField
          label={t("studentIdNo")}
          value={x.studentIdNo}
          onChangeText={set("studentIdNo")}
          maxLength={40}
          autoCorrect={false}
        />
        {role === "FORMER_STUDENT" ? (
          <View style={styles.stage}>
            <Text variant="small" weight="semibold">
              {t("currentStatus")}
            </Text>
            <Text variant="small">{r?.stage ?? t("unknown")}</Text>
            <Text variant="caption" tone="subtle">
              {t("stageFromHistory")}
            </Text>
          </View>
        ) : null}
      </>
    );
  } else {
    // Parents: current / former follows their children (family links).
    fields = (
      <Text variant="small" tone="muted">
        {t("parentDerived")}
      </Text>
    );
  }

  return (
    <View style={styles.form}>
      {fields}
      <ResultNotice result={save.data} />
      <FailedNotice error={save.error} />
      <Actions>
        <Button
          label={r ? t("save") : t("add")}
          variant={r ? "secondary" : "primary"}
          loading={save.isPending}
          onPress={submit}
        />
        {onCancel ? (
          <Button label={tc("cancel")} variant="ghost" onPress={onCancel} />
        ) : null}
      </Actions>
    </View>
  );
}

function Derived({ text }: { text: string }) {
  const t = useTranslations("adminMembers.roles");
  return <Notice tone="info">{`${t("derivedLabel")}: ${text}`}</Notice>;
}

const styles = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  dashed: {
    borderStyle: "dashed",
    borderColor: colors.slate300,
    borderWidth: 1,
  },
  summary: {
    minHeight: TOUCH + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  pressed: { backgroundColor: colors.slate50 },
  rotate: { transform: [{ rotate: "90deg" }] },
  flex: { flex: 1 },
  body: {
    gap: space.md,
    padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  record: { gap: 2 },
  form: { gap: space.md },
  stage: { gap: 2 },
});
