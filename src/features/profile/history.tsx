import type {
  EducationEntry,
  EducationLevel,
  HistoryEditor,
  HistoryInput,
  HistoryVisibility,
  TwoLevelGroup,
  WorkEntry,
} from "@contract/profile";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, Stack, useRouter } from "expo-router";
import { Pencil, Plus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { confirmAction } from "@/features/me/confirm";
import { Notice } from "@/features/me/parts";
import { ApiError } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  colors,
  ErrorState,
  QueryState,
  radius,
  Screen,
  space,
  Text,
  TextField,
} from "@/ui";
import {
  historyApi,
  refreshProfile,
  useHistoryEditor,
  useProfileForm,
} from "./api";
import { FormMessage, FormScreen, SelectSheet } from "./form-parts";
import { OrgPicker } from "./org-picker";

type Kind = "education" | "work";

const LEVELS: EducationLevel[] = [
  "JUNIOR_HIGH",
  "HIGH_SCHOOL",
  "UNIVERSITY",
  "GRADUATE_SCHOOL",
  "VOCATIONAL",
  "OTHER",
];
const VISIBILITIES: HistoryVisibility[] = ["MEMBERS", "FOLLOWERS"];

const years = (
  e: { startYear: number | null; endYear: number | null },
  present: string,
) => `${e.startYear ?? ""}–${e.endYear ?? present}`;

function entryHref(kind: Kind, id?: string, userId?: string): Href {
  const params: Record<string, string> = { kind };
  if (id) params.id = id;
  if (userId) params.userId = userId;
  return { pathname: "/profile/history-entry", params } as Href;
}

/**
 * 学歴・職歴 (the website's /app/profile/history — HistoryEditor): my
 * entries, current first; add, edit and remove them. With `userId`, an
 * admin edits that member's (管理 → 会員).
 */
export function HistoryScreen({ userId }: { userId?: string }) {
  const t = useTranslations("history");
  const query = useHistoryEditor(userId);
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {(data) => (
          <Screen
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
          >
            {userId ? null : (
              <Text variant="small" tone="muted">
                {t("description")}
              </Text>
            )}
            <HistoryEditorView data={data} userId={userId} />
          </Screen>
        )}
      </QueryState>
    </>
  );
}

/** The two sections (for embedding, e.g. in an admin member screen). */
export function HistoryEditorView({
  data,
  userId,
}: {
  data: HistoryEditor;
  userId?: string;
}) {
  const t = useTranslations("history");
  return (
    <>
      {data.multipleCurrent ? (
        <Notice>
          {`${t("multipleCurrent.title", { count: data.multipleCurrent.count })}\n${t(
            userId ? "multipleCurrent.bodyAdmin" : "multipleCurrent.body",
            { name: data.multipleCurrent.detail },
          )}`}
        </Notice>
      ) : null}
      <Section kind="education" entries={data.education} userId={userId} />
      <Section kind="work" entries={data.work} userId={userId} />
    </>
  );
}

function Section({
  kind,
  entries,
  userId,
}: {
  kind: Kind;
  entries: (EducationEntry | WorkEntry)[];
  userId?: string;
}) {
  const t = useTranslations("history");
  const router = useRouter();
  return (
    <Card style={styles.card}>
      <View>
        <Text variant="subheading" accessibilityRole="header">
          {t(kind)}
        </Text>
        <Text variant="small" tone="muted">
          {t(`intro.${kind}`)}
        </Text>
      </View>
      {entries.length ? (
        <View style={styles.entries}>
          {entries.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              onEdit={() => router.push(entryHref(kind, e.id, userId))}
            />
          ))}
        </View>
      ) : (
        <Text tone="subtle" center>
          {t(`empty.${kind}`)}
        </Text>
      )}
      <Button
        variant="secondary"
        label={t(`addTitle.${kind}`)}
        icon={(c) => <Plus color={c} size={18} aria-hidden />}
        onPress={() => router.push(entryHref(kind, undefined, userId))}
      />
    </Card>
  );
}

function EntryRow({
  entry: e,
  onEdit,
}: {
  entry: EducationEntry | WorkEntry;
  onEdit: () => void;
}) {
  const t = useTranslations("history");
  const edu = "school" in e;
  const detail = edu
    ? `${t(`levels.${e.level}`)}${e.field ? ` · ${e.field}` : ""}`
    : (e.title ?? "");
  return (
    <View style={styles.entry}>
      <View style={styles.entryHead}>
        <View style={styles.entryMain}>
          <View style={styles.badges}>
            <Text weight="medium">{edu ? e.school.name : e.company.name}</Text>
            {e.current ? <Badge tone="green" label={t("current")} /> : null}
            <Badge
              tone={e.visibility === "MEMBERS" ? "brand" : "slate"}
              label={t(`visibility.${e.visibility}`)}
            />
          </View>
          <Text variant="small" tone="muted">
            {`${detail ? `${detail} · ` : ""}${years(e, t("present"))}`}
          </Text>
          {!edu
            ? [e.industryLabel, e.jobTypeLabel].map((line, i) =>
                line ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed pair
                  <Text key={i} variant="caption" tone="subtle">
                    {line}
                  </Text>
                ) : null,
              )
            : null}
        </View>
        <Button
          variant="secondary"
          compact
          hitSlop={4}
          label={t("edit")}
          icon={(c) => <Pencil color={c} size={14} aria-hidden />}
          onPress={onEdit}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Add / edit one entry (the website's HistoryForm)
// ---------------------------------------------------------------------------

export function HistoryEntryScreen({
  kind,
  id,
  userId,
}: {
  kind: Kind;
  id?: string;
  userId?: string;
}) {
  const t = useTranslations("history");
  const query = useHistoryEditor(userId);
  return (
    <>
      <Stack.Screen
        options={{ title: id ? t("edit") : t(`addTitle.${kind}`) }}
      />
      <QueryState query={query}>
        {(data) => {
          const list: (EducationEntry | WorkEntry)[] =
            kind === "education" ? data.education : data.work;
          const entry = id ? list.find((e) => e.id === id) : undefined;
          if (id && !entry)
            return <ErrorState error={new ApiError(404, "not_found")} />;
          return (
            <HistoryForm
              kind={kind}
              entry={entry}
              data={data}
              userId={userId}
            />
          );
        }}
      </QueryState>
    </>
  );
}

const str = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

/** The 大分類 of a stored code ("ICT-01" → "ICT"). */
const groupOf = (list: TwoLevelGroup[], code?: string | null) =>
  code
    ? (list.find((g) => g.code === code || code.startsWith(`${g.code}-`))
        ?.code ?? "")
    : "";

function HistoryForm({
  kind,
  entry,
  data,
  userId,
}: {
  kind: Kind;
  entry?: EducationEntry | WorkEntry;
  data: HistoryEditor;
  userId?: string;
}) {
  const t = useTranslations("history");
  const tc = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const h = historyApi(userId);
  const edu = entry && "school" in entry ? entry : undefined;
  const work = entry && "company" in entry ? entry : undefined;

  const [level, setLevel] = useState<string>(edu?.level ?? "");
  const [org, setOrg] = useState(
    edu
      ? { name: edu.school.name, id: edu.school.id }
      : work
        ? { name: work.company.name, id: work.company.id }
        : { name: "", id: "" },
  );
  const [field, setField] = useState(str(edu?.field));
  const [title, setTitle] = useState(str(work?.title));
  const [industry, setIndustry] = useState(work?.industry ?? "");
  const [jobType, setJobType] = useState(work?.jobType ?? "");
  const [startYear, setStartYear] = useState(str(entry?.startYear));
  const [endYear, setEndYear] = useState(str(entry?.endYear));
  const [visibility, setVisibility] = useState<HistoryVisibility>(
    entry?.visibility ?? (kind === "education" ? "MEMBERS" : "FOLLOWERS"),
  );
  const [deleting, setDeleting] = useState(false);

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: h.key });
    router.back();
  };
  const { mutation, status, fieldError } = useProfileForm(h.save, done);
  const err = (f: string) => {
    const code = fieldError(f);
    return code ? t(`fieldErrors.${code}`) : null;
  };

  const submit = () => {
    const common = {
      id: entry?.id,
      startYear,
      endYear,
      visibility,
    };
    const input: HistoryInput =
      kind === "education"
        ? {
            kind,
            ...common,
            level,
            school: org.name,
            schoolId: org.id || undefined,
            field,
          }
        : {
            kind,
            ...common,
            company: org.name,
            companyId: org.id || undefined,
            title,
            industry,
            jobType,
          };
    mutation.mutate(input);
  };

  const remove = async () => {
    if (!entry) return;
    const ok = await confirmAction({
      title: t("deleteConfirm"),
      confirm: t("delete"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await h.remove(kind, entry.id);
      await refreshProfile(queryClient);
      await done();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <FormScreen>
      {kind === "education" ? (
        <>
          <SelectSheet
            label={`${t("fields.level")} *`}
            placeholder={t("choose")}
            choices={LEVELS.map((l) => ({ value: l, label: t(`levels.${l}`) }))}
            value={level}
            onChange={setLevel}
            error={err("level")}
          />
          <OrgPicker
            kind="school"
            label={t("fields.school")}
            name={org.name}
            id={org.id}
            onChange={setOrg}
            error={err("school")}
          />
          <TextField
            label={t("fields.field")}
            error={err("field")}
            value={field}
            onChangeText={setField}
            maxLength={120}
          />
        </>
      ) : (
        <>
          <OrgPicker
            kind="company"
            label={t("fields.company")}
            name={org.name}
            id={org.id}
            onChange={setOrg}
            error={err("company")}
          />
          <TextField
            label={t("fields.title")}
            error={err("title")}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <TwoLevelPicker
            kind="industry"
            list={data.industries}
            value={industry}
            onChange={setIndustry}
            error={err("industry")}
          />
          <TwoLevelPicker
            kind="jobType"
            list={data.jobTypes}
            value={jobType}
            onChange={setJobType}
            error={err("jobType")}
          />
        </>
      )}
      <View style={styles.years}>
        <View style={styles.year}>
          <TextField
            label={t("fields.startYear")}
            error={err("startYear")}
            value={startYear}
            onChangeText={setStartYear}
            keyboardType="number-pad"
            maxLength={4}
            placeholder={t("yearPlaceholder")}
          />
        </View>
        <View style={styles.year}>
          <TextField
            label={t("fields.endYear")}
            error={err("endYear")}
            value={endYear}
            onChangeText={setEndYear}
            keyboardType="number-pad"
            maxLength={4}
            placeholder={t("yearPlaceholder")}
          />
        </View>
      </View>
      <Text variant="small" tone="muted">
        {t(`hints.endYear.${kind}`)}
      </Text>
      <SelectSheet
        label={t("fields.visibility")}
        hint={t("hints.visibility")}
        choices={VISIBILITIES.map((v) => ({
          value: v,
          label: t(`visibility.${v}`),
        }))}
        value={visibility}
        onChange={(v) => setVisibility(v as HistoryVisibility)}
      />
      <FormMessage status={status} t={t} />
      <Button
        label={mutation.isPending ? t("saving") : entry ? t("save") : t("add")}
        loading={mutation.isPending}
        onPress={submit}
      />
      {entry ? (
        <View style={styles.danger}>
          <Button
            variant="ghost"
            label={t("delete")}
            loading={deleting}
            icon={(c) => <Trash2 color={c} size={18} aria-hidden />}
            onPress={remove}
          />
        </View>
      ) : null}
    </FormScreen>
  );
}

/**
 * 業種 / 職種 (the website's TwoLevelPicker): the 大分類, then the detail
 * within it; sends one code (the detail, or the 大分類 if none).
 */
function TwoLevelPicker({
  kind,
  list,
  value,
  onChange,
  error,
}: {
  kind: "industry" | "jobType";
  list: TwoLevelGroup[];
  value: string;
  onChange: (code: string) => void;
  error?: string | null;
}) {
  const t = useTranslations("history");
  const group = groupOf(list, value);
  const item = value && value !== group ? value : "";
  const current = list.find((g) => g.code === group);
  return (
    <>
      <SelectSheet
        label={t(`fields.${kind}`)}
        hint={t("twoLevelHint")}
        error={error}
        choices={[
          { value: "", label: t("industryNone") },
          ...list.map((g) => ({ value: g.code, label: g.label })),
        ]}
        value={group}
        onChange={onChange}
      />
      {current ? (
        <SelectSheet
          label={t(`fields.${kind}Detail`)}
          choices={[
            { value: "", label: t("industryDetailAny") },
            ...current.children.map((c) => ({ value: c.code, label: c.label })),
          ]}
          value={item}
          onChange={(v) => onChange(v || group)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  entries: { gap: space.sm },
  entry: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
  },
  entryHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  entryMain: { flex: 1, gap: 2 },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.xs,
  },
  years: { flexDirection: "row", gap: space.md },
  year: { flex: 1 },
  danger: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.md,
  },
});
