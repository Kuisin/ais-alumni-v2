import type {
  AdminCohort,
  AdminCohortRep,
  AdminFormResult,
} from "@contract/admin-manage";
import { Stack } from "expo-router";
import { UserPlus, Users, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Notice } from "@/features/events/parts";
import { confirmAction } from "@/features/me/confirm";
import { useAuth } from "@/lib/auth";
import { joinList } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  QueryState,
  radius,
  Screen,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";
import {
  adminManageApi,
  useAdminCohorts,
  useCohortStudents,
  useRefreshAdmin,
} from "./api";

/** 学年の管理 (the website's /app/admin/cohorts). */
export function AdminCohortsScreen() {
  const t = useTranslations("cohorts");
  const query = useAdminCohorts();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {({ cohorts }) => (
          <Screen refreshing={refreshing} onRefresh={onRefresh}>
            <Text variant="small" tone="muted">
              {t("description")}
            </Text>
            {cohorts.length === 0 ? (
              <EmptyState
                icon={<Users color={colors.slate400} size={28} aria-hidden />}
                title={t("empty")}
                hint={t("emptyHint")}
              />
            ) : (
              cohorts.map((c) => <CohortCard key={c.id} cohort={c} />)
            )}
          </Screen>
        )}
      </QueryState>
    </>
  );
}

/** View first; 編集 opens the years / note, reps and delete. */
function CohortCard({ cohort: c }: { cohort: AdminCohort }) {
  const t = useTranslations("cohorts");
  const tc = useTranslations("common");
  const { locale } = useAuth();
  const [editing, setEditing] = useState(false);
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text variant="subheading" accessibilityRole="header">
          {t("numberValue", { number: c.number })}
        </Text>
        <Badge
          label={c.graduated ? t("status.graduated") : t("status.current")}
          tone={c.graduated ? "slate" : "green"}
        />
        <View style={styles.flex} />
        <Button
          compact
          variant="ghost"
          label={editing ? tc("close") : t("edit")}
          accessibilityState={{ expanded: editing }}
          onPress={() => setEditing((v) => !v)}
        />
      </View>
      <Text variant="small" tone="muted">
        {c.subtitle} · {t("members", { count: c.members })}
      </Text>
      {c.note ? <Text variant="small">{c.note}</Text> : null}
      <Text variant="small">
        <Text variant="small" weight="medium">
          {t("reps.title")}:{" "}
        </Text>
        {c.reps.length ? (
          joinList(
            c.reps.map((r) => r.name),
            locale,
          )
        ) : (
          <Text variant="small" tone="subtle">
            {t("reps.none")}
          </Text>
        )}
      </Text>
      {editing ? (
        <CohortEdit cohort={c} onSaved={() => setEditing(false)} />
      ) : null}
    </Card>
  );
}

function CohortEdit({
  cohort: c,
  onSaved,
}: {
  cohort: AdminCohort;
  onSaved: () => void;
}) {
  const t = useTranslations("cohorts");
  const tc = useTranslations("common");
  const refresh = useRefreshAdmin();
  const [start, setStart] = useState(String(c.elementaryStartYear));
  const [end, setEnd] = useState(String(c.elementaryEndYear));
  const [note, setNote] = useState(c.note ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<AdminFormResult | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      const r = await adminManageApi.saveCohort(c.id, {
        elementaryStartYear: start,
        elementaryEndYear: end,
        note,
      });
      setResult(r);
      if (r.ok) {
        await refresh("cohorts");
        onSaved();
      }
    } catch {
      setResult({ ok: false, message: "errors.forbidden" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirmAction({
      title: t("deleteConfirm"),
      confirm: t("delete"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await adminManageApi.deleteCohort(c.id);
    } finally {
      setDeleting(false);
      await refresh("cohorts");
    }
  };

  return (
    <View style={styles.edit}>
      <TextField
        label={t("fields.elementaryStartYear")}
        value={start}
        onChangeText={setStart}
        inputMode="numeric"
        keyboardType="number-pad"
        maxLength={4}
      />
      <TextField
        label={t("fields.elementaryEndYear")}
        hint={t("hints.endChangesNumber")}
        value={end}
        onChangeText={setEnd}
        inputMode="numeric"
        keyboardType="number-pad"
        maxLength={4}
      />
      <TextField
        label={t("fields.note")}
        value={note}
        onChangeText={setNote}
        maxLength={200}
      />
      {result?.message ? (
        <Notice tone={result.ok ? "success" : "error"}>
          {t(result.message)}
        </Notice>
      ) : null}
      <Button
        variant="secondary"
        label={t("save")}
        loading={saving}
        onPress={save}
      />
      <CohortReps cohortId={c.id} reps={c.reps} />
      <View style={styles.danger}>
        {c.deletable ? (
          <Button
            variant="danger"
            label={t("delete")}
            loading={deleting}
            onPress={remove}
          />
        ) : (
          <Text variant="small" tone="muted">
            {t("cannotDelete")}
          </Text>
        )}
      </View>
    </View>
  );
}

/** The 学年代表 of one 学年, chosen from its students and graduates. */
function CohortReps({
  cohortId,
  reps,
}: {
  cohortId: string;
  reps: AdminCohortRep[];
}) {
  const t = useTranslations("cohorts.reps");
  const ta = useTranslations("adminMembers.positions");
  const tc = useTranslations("common");
  const refresh = useRefreshAdmin();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search 250 ms after typing stops (as the website).
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim().slice(0, 60)), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const results = useCohortStudents(cohortId, q);

  const set = async (userId: string, on: boolean) => {
    setPending(true);
    setError(null);
    try {
      const r = await adminManageApi.setCohortRep(cohortId, userId, on);
      if (!r.ok) setError(ta(r.message ?? "errors.invalid"));
    } catch {
      setError(ta("errors.forbidden"));
    } finally {
      setText("");
      setQ("");
      await refresh("cohorts");
      setPending(false);
    }
  };

  const remove = async (r: AdminCohortRep) => {
    const ok = await confirmAction({
      title: t("removeConfirm", { name: r.name }),
      confirm: t("remove", { name: r.name }),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) await set(r.id, false);
  };

  const ids = new Set(reps.map((r) => r.id));
  const fresh =
    q && results.data ? results.data.filter((r) => !ids.has(r.id)) : null;

  return (
    <View style={styles.reps} accessibilityState={{ busy: pending }}>
      <Text variant="small" weight="semibold">
        {t("title")}
      </Text>
      {reps.length ? (
        <View style={styles.chips}>
          {reps.map((r) => (
            <Pressable
              key={r.id}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel={t("remove", { name: r.name })}
              onPress={() => remove(r)}
              style={({ pressed }) => [
                styles.chip,
                pressed ? styles.chipPressed : null,
              ]}
            >
              <Text variant="small" style={{ color: colors.brand900 }}>
                {r.name}
              </Text>
              {r.kanji ? (
                <Text variant="caption" tone="brand">
                  {r.kanji}
                </Text>
              ) : null}
              <X size={16} color={colors.brand700} aria-hidden />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text variant="small" tone="muted">
          {t("none")}
        </Text>
      )}
      <Text variant="caption" tone="subtle">
        {t("hint")}
      </Text>
      <TextField
        value={text}
        onChangeText={setText}
        placeholder={t("search")}
        accessibilityLabel={t("search")}
        autoCorrect={false}
        autoCapitalize="none"
        inputMode="search"
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {fresh && fresh.length === 0 ? (
        <Text variant="small" tone="muted">
          {t("noResults")}
        </Text>
      ) : null}
      {fresh?.map((r) => (
        <Pressable
          key={r.id}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel={t("add", { name: r.name })}
          onPress={() => set(r.id, true)}
          style={({ pressed }) => [
            styles.result,
            pressed ? styles.chipPressed : null,
          ]}
        >
          <UserPlus size={16} color={colors.brand700} aria-hidden />
          <Text variant="small">{r.name}</Text>
          {r.kanji ? (
            <Text variant="small" tone="muted">
              {r.kanji}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  edit: {
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.md,
    marginTop: space.xs,
  },
  danger: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate100,
    paddingTop: space.md,
  },
  reps: {
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    padding: space.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingLeft: space.md,
    paddingRight: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brand300,
    backgroundColor: colors.white,
  },
  chipPressed: { backgroundColor: colors.brand50 },
  result: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
});
