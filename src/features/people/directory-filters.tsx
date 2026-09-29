import type { DirectoryFilters, DirectoryOptions } from "@contract/people";
import { Search, SlidersHorizontal } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  Button,
  Card,
  colors,
  font,
  radius,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";
import { type DirectoryForm, EMPTY_FORM } from "./api";
import { Chips, type Choice, ChoiceList, SelectField } from "./choices";
import { Sheet } from "./sheet";

/**
 * The directory's search (src/components/directory/filter-form.tsx): the
 * name, 区分, and the other filters in a 「絞り込み」 sheet. Values apply
 * as they change (the name after a short pause).
 */

/** Filters besides the name and 区分 that are on (the 「N件」 count). */
export function activeFilterCount(f: DirectoryFilters | undefined): number {
  if (!f) return 0;
  return [
    f.from !== null || f.to !== null,
    f.division,
    f.cohort,
    f.stage,
  ].filter(Boolean).length;
}

export function DirectorySearch({
  query,
  onQuery,
  onSubmit,
  form,
  applied,
  options,
  onChange,
}: {
  /** the name field as typed */
  query: string;
  onQuery: (q: string) => void;
  onSubmit: () => void;
  form: DirectoryForm;
  /** what the server applied (last result) */
  applied: DirectoryFilters | undefined;
  options: DirectoryOptions | undefined;
  onChange: (form: DirectoryForm) => void;
}) {
  const t = useTranslations("directory");
  const tr = useTranslations("roles");
  const [sheet, setSheet] = useState<null | "role" | "filters">(null);
  const [openKey, setOpenKey] = useState(0);
  const role = form.role || applied?.role || options?.defaultRole || "";
  const roleLabel = (r: string) =>
    r === (options?.allRoles ?? "all")
      ? t("filters.anyRole")
      : r
        ? tr(`audience.${r}`)
        : "";
  const roleChoices: Choice[] = options
    ? [
        ...options.roles.map((r) => ({ value: r, label: roleLabel(r) })),
        { value: options.allRoles, label: t("filters.anyRole") },
      ]
    : [];
  const count = activeFilterCount(applied);

  return (
    <Card style={styles.card}>
      <View style={styles.field}>
        <Text variant="small" weight="semibold">
          {t("filters.q")}
        </Text>
        <View style={styles.search}>
          <Search size={18} color={colors.slate400} aria-hidden />
          <TextInput
            value={query}
            onChangeText={onQuery}
            onSubmitEditing={onSubmit}
            placeholder={t("filters.qPlaceholder")}
            placeholderTextColor={colors.slate400}
            accessibilityLabel={t("filters.q")}
            returnKeyType="search"
            enterKeyHint="search"
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="off"
            clearButtonMode="while-editing"
            maxLength={100}
            style={styles.input}
          />
        </View>
      </View>
      {/* 区分: former students unless chosen otherwise (defaultRole). */}
      <SelectField
        label={t("filters.role")}
        value={roleLabel(role)}
        onPress={() => setSheet("role")}
      />
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            count > 0
              ? `${t("filters.more")} (${t("filters.activeCount", { count })})`
              : t("filters.more")
          }
          onPress={() => {
            // A fresh form each time the sheet opens.
            setOpenKey((k) => k + 1);
            setSheet("filters");
          }}
          style={({ pressed }) => [
            styles.more,
            pressed ? styles.pressed : null,
          ]}
        >
          <SlidersHorizontal size={18} color={colors.brand700} aria-hidden />
          <Text variant="small" weight="semibold" tone="brand">
            {t("filters.more")}
          </Text>
          {count > 0 ? (
            <View style={styles.count}>
              <Text
                variant="caption"
                weight="semibold"
                style={styles.countText}
              >
                {t("filters.activeCount", { count })}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Sheet
        visible={sheet === "role"}
        onClose={() => setSheet(null)}
        title={t("filters.role")}
      >
        <ChoiceList
          label={t("filters.role")}
          choices={roleChoices}
          value={role}
          onChange={(v) => {
            onChange({ ...form, role: v === options?.defaultRole ? "" : v });
            setSheet(null);
          }}
        />
      </Sheet>
      <Sheet
        visible={sheet === "filters"}
        onClose={() => setSheet(null)}
        title={t("filters.more")}
      >
        {options ? (
          <FilterForm
            key={openKey}
            form={form}
            options={options}
            onApply={(f) => {
              onChange(f);
              setSheet(null);
            }}
          />
        ) : null}
      </Sheet>
    </Card>
  );
}

function validYear(v: string, o: DirectoryOptions): boolean {
  if (!v.trim()) return true;
  if (!/^\d{4}$/.test(v.trim())) return false;
  const n = Number(v);
  return n >= o.minYear && n <= o.maxYear;
}

/** 「絞り込み」: year range, 最終在籍部, 学年, 現在の状況. */
function FilterForm({
  form,
  options,
  onApply,
}: {
  form: DirectoryForm;
  options: DirectoryOptions;
  onApply: (form: DirectoryForm) => void;
}) {
  const t = useTranslations("directory");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const [draft, setDraft] = useState(form);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const any = { value: "", label: t("filters.any") };
  const fromOk = validYear(draft.from, options);
  const toOk = validYear(draft.to, options);
  const cohortLabel =
    options.cohorts.find((c) => c.id === draft.cohort)?.label ??
    t("filters.any");

  const apply = () => {
    setChecked(true);
    if (!fromOk || !toOk) return;
    onApply({ ...draft, from: draft.from.trim(), to: draft.to.trim() });
  };

  return (
    <>
      <View style={styles.field}>
        <Text variant="small" weight="semibold">
          {t("filters.yearRange")}
        </Text>
        <View style={styles.years}>
          <View style={styles.grow}>
            <TextField
              value={draft.from}
              onChangeText={(v) =>
                setDraft({ ...draft, from: v.replace(/\D/g, "").slice(0, 4) })
              }
              placeholder={t("filters.yearFrom")}
              accessibilityLabel={`${t("filters.yearRange")}: ${t("filters.yearFrom")}`}
              keyboardType="number-pad"
              maxLength={4}
              error={checked && !fromOk ? tc("errors.validation") : null}
            />
          </View>
          <Text aria-hidden style={styles.dash}>
            –
          </Text>
          <View style={styles.grow}>
            <TextField
              value={draft.to}
              onChangeText={(v) =>
                setDraft({ ...draft, to: v.replace(/\D/g, "").slice(0, 4) })
              }
              placeholder={t("filters.yearTo")}
              accessibilityLabel={`${t("filters.yearRange")}: ${t("filters.yearTo")}`}
              keyboardType="number-pad"
              maxLength={4}
              error={checked && !toOk ? tc("errors.validation") : null}
            />
          </View>
        </View>
      </View>
      <Chips
        label={t("filters.division")}
        value={draft.division}
        onChange={(v) => setDraft({ ...draft, division: v })}
        choices={[
          any,
          ...options.divisions.map((d) => ({
            value: d,
            label: tr(`division.${d}`),
          })),
        ]}
      />
      <View style={styles.field}>
        <SelectField
          label={t("filters.cohort")}
          value={cohortLabel}
          expanded={cohortOpen}
          onPress={() => setCohortOpen(!cohortOpen)}
        />
        {cohortOpen ? (
          <ChoiceList
            label={t("filters.cohort")}
            value={draft.cohort}
            onChange={(v) => {
              setDraft({ ...draft, cohort: v });
              setCohortOpen(false);
            }}
            choices={[
              any,
              ...options.cohorts.map((c) => ({ value: c.id, label: c.label })),
            ]}
          />
        ) : null}
      </View>
      <Chips
        label={t("filters.stage")}
        value={draft.stage}
        onChange={(v) => setDraft({ ...draft, stage: v })}
        choices={[
          any,
          ...options.stages.map((s) => ({ value: s, label: tr(`stage.${s}`) })),
        ]}
      />
      <View style={styles.buttons}>
        <Button label={t("filters.applyFilters")} onPress={apply} />
        <Button
          variant="secondary"
          label={t("filters.clear")}
          onPress={() => onApply(EMPTY_FORM)}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.md },
  field: { gap: space.xs },
  search: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    minHeight: TOUCH - 2,
    fontSize: font.size.md,
    color: colors.text,
    paddingVertical: space.sm,
  },
  row: { flexDirection: "row" },
  grow: { flex: 1 },
  more: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.brand50 },
  count: {
    backgroundColor: colors.brand100,
    borderRadius: radius.full,
    paddingHorizontal: 6,
  },
  countText: { color: colors.brand800 },
  years: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  dash: { paddingTop: space.sm + 2 },
  buttons: { gap: space.sm },
});
