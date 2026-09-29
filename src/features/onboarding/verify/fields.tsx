import { ChevronDown } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { colors, radius, space, Text, TOUCH } from "@/ui";
import { Select } from "../controls";
import {
  type CohortChoice,
  classYears,
  type Errors,
  elementaryEndFor,
  gradeLabel,
  schoolYearStart,
  studentStatus,
} from "./rules";

/** verify.errors.<code> for a form path, or null. */
export function useErrorText(errors: Errors) {
  const t = useTranslations("verify");
  return (path: string): string | null => {
    const code = errors[path];
    return code ? t(`errors.${code}`) : null;
  };
}

/** A four-digit year, or null. */
export const num = (v: string): number | null =>
  /^\d{4}$/.test(v.trim()) ? Number(v) : null;

/** 「→ … として登録されます」 — the status the app works out. */
export function Preview({ children }: { children: ReactNode }) {
  return (
    <View style={styles.preview} accessibilityLiveRegion="polite">
      <Text variant="small" style={styles.previewText}>
        {`→ ${children}`}
      </Text>
    </View>
  );
}

/** Status preview for a 学年 number + optional leave year. */
export function useStudentPreview() {
  const t = useTranslations("verify");
  const { locale } = useAuth();
  return (cohortNumber: string, leftYear: string): string | null => {
    const n = Number(cohortNumber);
    if (!Number.isInteger(n) || n < 1) return null;
    const st = studentStatus(elementaryEndFor(n), num(leftYear));
    if (st.current)
      return st.currentGrade !== null
        ? t("preview.current", { grade: gradeLabel(st.currentGrade, locale) })
        : t("preview.upcoming");
    return st.didGraduate
      ? t("preview.graduated", { year: st.graduationOrLeaveYear ?? "" })
      : t("preview.left", { year: st.graduationOrLeaveYear ?? "" });
  };
}

/**
 * 学年 picker: every 学年, newest first. Optional unless `required`:
 * 「一覧にない・わからない」 leaves it for the committee.
 */
export function CohortPicker({
  path,
  value,
  onChange,
  errors,
  cohorts,
  required = false,
}: {
  path: string;
  value: string;
  onChange: (v: string) => void;
  errors: Errors;
  cohorts: CohortChoice[];
  required?: boolean;
}) {
  const t = useTranslations("verify");
  const err = useErrorText(errors);
  const selected = cohorts.find((c) => c.value === value);
  return (
    <View style={styles.gap}>
      <Select
        label={t("fields.cohort")}
        optional={!required}
        hint={t("hints.cohort")}
        error={err(path)}
        value={value}
        onChange={onChange}
        options={cohorts}
        placeholder={required ? t("select") : t("cohortNotListed")}
        clearable={!required}
      />
      {selected ? <ClassYears cohortNumber={Number(selected.value)} /> : null}
    </View>
  );
}

/**
 * For the chosen 第N期: the class name each school year, so members can
 * check it's their 学年 (open at first, like the website's).
 */
function ClassYears({ cohortNumber }: { cohortNumber: number }) {
  const t = useTranslations("verify.classYears");
  const { locale } = useAuth();
  const [open, setOpen] = useState(true);
  const now = schoolYearStart();
  const en = locale === "en";
  return (
    <View style={styles.years}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.yearsHead}
      >
        <Text variant="small" weight="medium" style={styles.flex}>
          {t("title", { number: cohortNumber })}
        </Text>
        <ChevronDown
          size={16}
          color={colors.slate500}
          aria-hidden
          style={open ? styles.flip : undefined}
        />
      </Pressable>
      {open ? (
        <View style={styles.yearsBody}>
          <Text variant="caption" tone="muted">
            {t("hint")}
          </Text>
          <View style={styles.yearRow}>
            <Text variant="caption" tone="subtle" style={styles.yearCol}>
              {t("year")}
            </Text>
            <Text variant="caption" tone="subtle" style={styles.flex}>
              {t("class")}
            </Text>
          </View>
          {classYears(cohortNumber).map((r) => {
            const current = r.schoolYear === now;
            return (
              <View
                key={r.grade}
                style={[styles.yearRow, current ? styles.current : null]}
              >
                <Text
                  variant="small"
                  weight={current ? "semibold" : "regular"}
                  style={styles.yearCol}
                >
                  {en
                    ? `${r.schoolYear}–${String(r.schoolYear + 1).slice(2)}`
                    : `${r.schoolYear}年度`}
                  {current ? (
                    <Text variant="caption" tone="brand">
                      {` ${t("now")}`}
                    </Text>
                  ) : null}
                </Text>
                <Text
                  variant="small"
                  weight={current ? "semibold" : "regular"}
                  style={styles.flex}
                >
                  {en ? r.en : r.ja}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** A bordered block for one member type (the website's fieldset). */
export function TypeSection({
  icon,
  title,
  intro,
  children,
}: {
  icon: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text variant="subheading" accessibilityRole="header">
        {`${icon} ${title}`}
      </Text>
      <Text variant="small" tone="muted">
        {intro}
      </Text>
      {children}
    </View>
  );
}

/** Folded optional part (the website's <details>). */
export function Details({
  summary,
  initiallyOpen = false,
  children,
}: {
  summary: string;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.details}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.yearsHead}
      >
        <Text variant="small" weight="medium" tone="brand" style={styles.flex}>
          {summary}
        </Text>
        <ChevronDown
          size={16}
          color={colors.brand700}
          aria-hidden
          style={open ? styles.flip : undefined}
        />
      </Pressable>
      {open ? <View style={styles.detailsBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.sm },
  preview: {
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  previewText: { color: colors.brand800 },
  years: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
  },
  yearsHead: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  yearsBody: { paddingHorizontal: space.md, paddingBottom: space.md },
  yearRow: {
    flexDirection: "row",
    gap: space.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  yearCol: { width: 120 },
  current: { backgroundColor: colors.brand50 },
  flip: { transform: [{ rotate: "180deg" }] },
  section: {
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: space.lg,
  },
  details: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  detailsBody: {
    gap: space.md,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
});
