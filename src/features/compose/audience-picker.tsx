import type {
  AudienceGroup,
  AudienceMember,
  AudienceSpec,
  CohortOption,
  ComposeOptions,
} from "@contract/compose";
import { Search, UserPlus, Users, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, radius, space, Text, TextField, TOUCH } from "@/ui";
import { useAudienceCount, useMemberSearch } from "./api";
import { ChoiceCard, FieldError, ToggleChip } from "./parts";

export const EVERYONE: AudienceSpec = {
  groups: [],
  cohortIds: [],
  includeParents: false,
  userIds: [],
};

const isEveryone = (s: AudienceSpec) =>
  !s.groups.length && !s.cohortIds.length && !s.userIds.length;

type CohortView = "all" | "graduated" | "current";

const toggle = <T,>(list: T[], v: T, on: boolean) =>
  on ? (list.includes(v) ? list : [...list, v]) : list.filter((x) => x !== v);

/**
 * 「受け取る人」 (the website's AudiencePicker): everyone, or any mix of
 * groups, 学年 (optionally with their parents) and individually chosen
 * members, with the live number of members reached. Narrowed by the
 * author's scope: current teachers always include current teachers;
 * 学年代表 choose only among their own 学年 (checked on save too).
 * Reports the spec through `onChange` (the form sends it as JSON).
 */
export function AudiencePicker({
  options,
  initialSpec,
  initialMembers,
  onChange,
  error,
}: {
  options: ComposeOptions;
  initialSpec: AudienceSpec;
  initialMembers: readonly AudienceMember[];
  onChange: (spec: AudienceSpec) => void;
  error?: string | null;
}) {
  const t = useTranslations("adminContent");
  const { scope, cohorts } = options;
  const ownCohorts = scope.kind === "COHORT" ? scope.cohortIds : null;
  const teacher = scope.kind === "TEACHER";
  const [custom, setCustom] = useState(
    ownCohorts !== null || !isEveryone(initialSpec),
  );
  const [groups, setGroups] = useState<AudienceGroup[]>(() =>
    teacher && !initialSpec.groups.includes("TEACHER_CURRENT")
      ? ["TEACHER_CURRENT", ...initialSpec.groups]
      : initialSpec.groups,
  );
  const [cohortIds, setCohortIds] = useState<string[]>(() => {
    if (!ownCohorts) return initialSpec.cohortIds;
    // 学年代表: their own 学年, all of them for a new post.
    const own = initialSpec.cohortIds.filter((c) => ownCohorts.includes(c));
    return own.length ? own : [...ownCohorts];
  });
  const [includeParents, setIncludeParents] = useState(
    initialSpec.includeParents,
  );
  const [members, setMembers] = useState<AudienceMember[]>(() => {
    const byId = new Map(initialMembers.map((m) => [m.id, m]));
    return initialSpec.userIds.map(
      (id) => byId.get(id) ?? { id, name: "—", kanji: null },
    );
  });

  const spec: AudienceSpec = useMemo(
    () =>
      custom
        ? {
            groups,
            cohortIds,
            includeParents: cohortIds.length > 0 && includeParents,
            userIds: members.map((m) => m.id),
          }
        : EVERYONE,
    [custom, groups, cohortIds, includeParents, members],
  );
  const json = JSON.stringify(spec);
  // biome-ignore lint/correctness/useExhaustiveDependencies: report when the spec changes (by value)
  useEffect(() => {
    onChange(spec);
  }, [json]);

  const count = useAudienceCount(spec);
  const countLine = (
    <View accessibilityLiveRegion="polite" style={styles.count}>
      <Users size={16} color={colors.brand800} aria-hidden />
      <Text variant="small" weight="medium" style={styles.countText}>
        {count === null
          ? t("audience.counting")
          : count === "error"
            ? t("audience.countError")
            : t("audience.count", { count })}
      </Text>
    </View>
  );

  // 学年代表: only their own 学年 (students and former students in it).
  if (ownCohorts) {
    const own = cohorts.filter((c) => ownCohorts.includes(c.id));
    return (
      <View style={styles.stack}>
        <Text variant="small" weight="medium">
          {t("audience.ownCohortLegend")}
        </Text>
        <Text variant="small" tone="subtle">
          {t("audience.ownCohortHint")}
        </Text>
        {own.map((c) => (
          <ChoiceCard
            key={c.id}
            label={c.label}
            checked={cohortIds.includes(c.id)}
            onChange={(on) => setCohortIds((l) => toggle(l, c.id, on))}
          />
        ))}
        <FieldError>{error ?? null}</FieldError>
        {countLine}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {teacher ? (
        <Text variant="small" tone="muted">
          {t("audience.teachersAlways")}
        </Text>
      ) : null}
      <View accessibilityRole="radiogroup" style={styles.stack}>
        <ChoiceCard
          radio
          label={t("audience.everyone")}
          hint={t("audience.everyoneHint")}
          checked={!custom}
          onChange={() => setCustom(false)}
        />
        <ChoiceCard
          radio
          label={t("audience.custom")}
          hint={t("audience.customHint")}
          checked={custom}
          onChange={() => setCustom(true)}
        />
      </View>

      {custom ? (
        <View style={styles.customBox}>
          <Text variant="small" tone="muted">
            {t("audience.anyHint")}
          </Text>
          <View style={styles.stack}>
            <Text variant="small" weight="medium">
              {t("audience.groupsLegend")}
            </Text>
            {options.groups.map((g) => (
              <ChoiceCard
                key={g}
                label={t(`audience.groups.${g}`)}
                hint={t(`audience.groupHints.${g}`)}
                checked={groups.includes(g)}
                // A teacher's post always reaches current teachers.
                disabled={teacher && g === "TEACHER_CURRENT"}
                onChange={(on) => setGroups((l) => toggle(l, g, on))}
              />
            ))}
          </View>
          <CohortPicker
            cohorts={cohorts}
            selected={cohortIds}
            onToggle={(id, on) => setCohortIds((l) => toggle(l, id, on))}
            onSet={setCohortIds}
            includeParents={includeParents}
            onIncludeParents={setIncludeParents}
          />
          <MemberPicker
            members={members}
            onAdd={(m) =>
              setMembers((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]))
            }
            onRemove={(id) => setMembers((l) => l.filter((x) => x.id !== id))}
          />
        </View>
      ) : null}
      <FieldError>{error ?? null}</FieldError>
      {countLine}
    </View>
  );
}

function CohortPicker({
  cohorts,
  selected,
  onToggle,
  onSet,
  includeParents,
  onIncludeParents,
}: {
  cohorts: readonly CohortOption[];
  selected: string[];
  onToggle: (id: string, on: boolean) => void;
  onSet: (ids: string[]) => void;
  includeParents: boolean;
  onIncludeParents: (on: boolean) => void;
}) {
  const t = useTranslations("adminContent");
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<CohortView>("all");
  const q = filter.trim().toLowerCase();
  const shown = cohorts.filter(
    (c) =>
      (view === "all" || c.graduated === (view === "graduated")) &&
      (!q || c.label.toLowerCase().includes(q)),
  );
  const views: [CohortView, string][] = [
    ["all", t("audience.showAll")],
    ["graduated", t("audience.showGraduated")],
    ["current", t("audience.showCurrent")],
  ];

  return (
    <View style={styles.stack}>
      <Text variant="small" weight="medium">
        {t("audience.cohortsLegend")}
      </Text>
      <Text variant="small" tone="subtle">
        {t("audience.cohortsHint")}
      </Text>
      <TextField
        label={t("audience.cohortFilter")}
        value={filter}
        onChangeText={setFilter}
        placeholder={t("audience.cohortFilterPlaceholder")}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <View
        accessibilityRole="toolbar"
        accessibilityLabel={t("audience.show")}
        style={styles.wrapRow}
      >
        {views.map(([v, label]) => (
          <ToggleChip
            key={v}
            label={label}
            pressed={view === v}
            onPress={() => setView(v)}
          />
        ))}
      </View>
      {shown.length ? (
        <ScrollView
          nestedScrollEnabled
          style={styles.cohortList}
          contentContainerStyle={styles.stack}
        >
          {shown.map((c) => (
            <ChoiceCard
              key={c.id}
              label={c.label}
              checked={selected.includes(c.id)}
              onChange={(on) => onToggle(c.id, on)}
            />
          ))}
        </ScrollView>
      ) : (
        <Text variant="small" tone="subtle">
          {t("audience.noCohorts")}
        </Text>
      )}
      <View style={styles.wrapRow}>
        <Text variant="small" tone="muted" style={styles.grow}>
          {t("audience.cohortsSelected", { count: selected.length })}
        </Text>
        <ToggleChip
          label={t("audience.selectShown")}
          pressed={false}
          disabled={!shown.length}
          onPress={() =>
            onSet([...new Set([...selected, ...shown.map((c) => c.id)])])
          }
        />
        <ToggleChip
          label={t("audience.clearCohorts")}
          pressed={false}
          disabled={!selected.length}
          onPress={() => onSet([])}
        />
      </View>
      <ChoiceCard
        label={t("audience.includeParents")}
        hint={t("audience.includeParentsHint")}
        checked={includeParents}
        onChange={onIncludeParents}
      />
    </View>
  );
}

function MemberPicker({
  members,
  onAdd,
  onRemove,
}: {
  members: AudienceMember[];
  onAdd: (m: AudienceMember) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("adminContent");
  const [q, setQ] = useState("");
  const { results, searching } = useMemberSearch(q);
  const label = (m: AudienceMember) =>
    m.kanji ? `${m.name}（${m.kanji}）` : m.name;

  return (
    <View style={styles.stack}>
      <Text variant="small" weight="medium">
        {t("audience.membersLegend")}
      </Text>
      {members.length ? (
        <>
          <Text variant="small" tone="muted">
            {t("audience.membersSelected", { count: members.length })}
          </Text>
          <View style={styles.wrapRow}>
            {members.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={t("audience.removeMember", {
                  name: label(m),
                })}
                onPress={() => onRemove(m.id)}
                style={({ pressed }) => [
                  styles.pill,
                  pressed ? styles.pillPressed : null,
                ]}
              >
                <Text variant="small" style={styles.pillText}>
                  {m.name}
                  {m.kanji ? (
                    <Text variant="caption" tone="brand">
                      {` ${m.kanji}`}
                    </Text>
                  ) : null}
                </Text>
                <X size={16} color={colors.brand800} aria-hidden />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <View>
        <TextField
          label={t("audience.memberSearch")}
          hint={t("audience.memberSearchHint")}
          value={q}
          onChangeText={setQ}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.searchInput}
        />
        <View style={styles.searchIcon} pointerEvents="none">
          <Search size={16} color={colors.slate400} aria-hidden />
        </View>
      </View>
      <View accessibilityLiveRegion="polite">
        {searching ? (
          <Text variant="small" tone="subtle">
            {t("audience.searching")}
          </Text>
        ) : results && results.length === 0 ? (
          <Text variant="small" tone="subtle">
            {t("audience.noResults")}
          </Text>
        ) : null}
      </View>
      {!searching && results?.length ? (
        <View style={styles.results}>
          {results.map((m) => {
            const added = members.some((x) => x.id === m.id);
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={t("audience.addMember", { name: label(m) })}
                accessibilityState={{ disabled: added }}
                disabled={added}
                onPress={() => onAdd(m)}
                style={({ pressed }) => [
                  styles.result,
                  pressed ? styles.pillPressed : null,
                ]}
              >
                <UserPlus
                  size={16}
                  color={added ? colors.slate400 : colors.brand700}
                  aria-hidden
                />
                <Text
                  variant="small"
                  tone={added ? "subtle" : "default"}
                  style={styles.grow}
                >
                  {m.name}
                  {m.kanji ? (
                    <Text variant="caption" tone="subtle">
                      {`  ${m.kanji}`}
                    </Text>
                  ) : null}
                </Text>
                {added ? (
                  <Text variant="caption" tone="subtle">
                    {t("audience.added")}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  grow: { flex: 1 },
  customBox: {
    gap: space.xl,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    padding: space.md,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  cohortList: {
    maxHeight: 320,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: space.sm,
  },
  count: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  countText: { color: colors.brand800 },
  pill: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.brand300,
    backgroundColor: colors.brand50,
    borderRadius: radius.full,
    paddingLeft: space.md,
    paddingRight: space.sm,
  },
  pillPressed: { backgroundColor: colors.brand100 },
  pillText: { color: colors.brand900 },
  searchInput: { paddingLeft: 36 },
  searchIcon: { position: "absolute", left: space.md, top: 38 },
  results: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  result: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slate200,
  },
});
