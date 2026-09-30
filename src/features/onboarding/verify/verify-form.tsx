import type { VerifyForm as VerifyFormData } from "@contract/onboarding";
import { GraduationCap } from "lucide-react-native";
import { type RefObject, useEffect, useState } from "react";
import { type ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { joinList } from "@/lib/format";
import { Button, colors, radius, space, Text } from "@/ui";
import {
  Checkbox,
  ChoiceCard,
  DateField,
  FieldLabel,
  FormText,
  Notice,
  Select,
} from "../controls";
import { EvidenceUploader } from "./evidence";
import { Details, useErrorText } from "./fields";
import {
  applicantGraduated,
  composeKanji,
  composeRomaji,
  type Errors,
  GENDERS,
  issuesToErrors,
  MEMBER_TYPES,
  type MemberType,
  parseCohortNumber,
  STEPS,
  type Step,
  stepOfPath,
  toPayload,
  type VerifyFormState,
  verificationSchema,
} from "./rules";
import { ParentSection, StudentSection, TeacherSection } from "./sections";

const TYPE_ICON: Record<MemberType, string> = {
  STUDENT: "🎓",
  PARENT: "👪",
  TEACHER: "🧑‍🏫",
};

function validate(state: VerifyFormState, uiLocale: "ja" | "en"): Errors {
  const r = verificationSchema({ requireKanji: uiLocale === "ja" }).safeParse(
    toPayload(state),
  );
  return r.success ? {} : issuesToErrors(r.error.issues);
}

function errorsForStep(errors: Errors, step: Step): Errors {
  return Object.fromEntries(
    Object.entries(errors).filter(([path]) => stepOfPath(path) === step),
  );
}

/**
 * The application wizard (the website's VerifyForm): who you are → about
 * you → details → review & send. Each step is checked with the shared Zod
 * schema; the server checks again. Sent: /me moves the account to the
 * status screen.
 */
export function VerifyForm({
  data,
  scrollRef,
  inviteToken,
  onSubmitted,
}: {
  data: VerifyFormData;
  scrollRef: RefObject<ScrollView | null>;
  /** the invitation the app kept, used up by this application */
  inviteToken: string | null;
  onSubmitted: () => Promise<void>;
}) {
  const t = useTranslations("verify");
  const tg = useTranslations("profile.photo");
  const { locale: uiLocale } = useAuth();
  const [state, setState] = useState<VerifyFormState>(
    data.initial as unknown as VerifyFormState,
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState(data.verifiedSchoolEmail);
  const step = STEPS[stepIndex];
  const err = useErrorText(errors);

  // Students: a parent may already have registered them (exact name + birth
  // date). They can still continue; the committee merges the two.
  const [registeredByParent, setRegisteredByParent] = useState(false);
  const isStudent = state.types.includes("STUDENT");
  useEffect(() => {
    if (step !== "details" || !isStudent || !state.dateOfBirth) return;
    let live = true;
    api<{ found: boolean }>("/onboarding/verify/managed-duplicate", {
      body: {
        lastNameRomaji: state.lastNameRomaji,
        firstNameRomaji: state.firstNameRomaji,
        lastNameKanji: state.lastNameKanji,
        firstNameKanji: state.firstNameKanji,
        dateOfBirth: state.dateOfBirth,
      },
    })
      .then((r) => {
        if (live) setRegisteredByParent(r.found);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [
    step,
    isStudent,
    state.lastNameRomaji,
    state.firstNameRomaji,
    state.lastNameKanji,
    state.firstNameKanji,
    state.dateOfBirth,
  ]);

  function set<K extends keyof VerifyFormState>(
    key: K,
    value: VerifyFormState[K],
  ) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function toggleType(type: MemberType) {
    setState((s) => ({
      ...s,
      types: s.types.includes(type)
        ? s.types.filter((x) => x !== type)
        : [...s.types, type],
    }));
  }

  const top = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  function goTo(index: number) {
    setErrors({});
    setServerError(null);
    setStepIndex(index);
    top();
  }

  function next() {
    const errs = errorsForStep(validate(state, uiLocale), step);
    setErrors(errs);
    if (Object.keys(errs).length) {
      top();
      return;
    }
    goTo(stepIndex + 1);
  }

  /** Errors (ours or the server's): show them on the step they belong to. */
  function showErrors(errs: Errors) {
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) setStepIndex(STEPS.indexOf(stepOfPath(first)));
    top();
  }

  async function submit() {
    const errs = validate(state, uiLocale);
    if (Object.keys(errs).length) {
      showErrors(errs);
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await api("/onboarding/verify", {
        body: {
          payload: toPayload(state),
          uiLocale,
          invite: inviteToken,
        },
      });
      await onSubmitted();
    } catch (e) {
      setSubmitting(false);
      const body = e instanceof ApiError ? e.body : null;
      const fields = body?.errors as Errors | undefined;
      if (fields && Object.keys(fields).length && body?.error !== "evidence")
        showErrors(fields);
      else {
        const code =
          e instanceof ApiError &&
          ["validation", "forbidden", "evidence"].includes(e.code)
            ? e.code
            : "generic";
        setServerError(t(`serverErrors.${code}`));
        if (fields) setErrors(fields);
        top();
      }
    }
  }

  const errorCount = Object.keys(errors).length;
  // 卒業証書: asked of graduates (worked out from the 学年 and leave year).
  const isGraduate =
    state.types.includes("STUDENT") &&
    applicantGraduated(
      parseCohortNumber(state.student.cohortNumber) ?? null,
      state.student.leftYear ? Number(state.student.leftYear) : null,
    );
  const diplomaItems = state.evidence.filter((e) => e.kind === "DIPLOMA");
  const otherItems = state.evidence.filter((e) => e.kind !== "DIPLOMA");
  const kanji = composeKanji(state);

  return (
    <View style={styles.form}>
      {/* Progress */}
      <View
        style={styles.gapSm}
        accessibilityRole="progressbar"
        accessibilityLabel={t("progressLabel")}
        accessibilityValue={{
          min: 1,
          max: STEPS.length,
          now: stepIndex + 1,
          text: t("stepOf", { n: stepIndex + 1, total: STEPS.length }),
        }}
      >
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${((stepIndex + 1) / STEPS.length) * 100}%` },
            ]}
          />
        </View>
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <Text
              key={s}
              variant="caption"
              center
              weight={i <= stepIndex ? "semibold" : "regular"}
              tone={i <= stepIndex ? "brand" : "subtle"}
              style={styles.flex}
            >
              {t(`steps.${s}`)}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.gapSm}>
        <Text variant="subheading" accessibilityRole="header">
          {t(`stepTitles.${step}`)}
        </Text>
        <Text tone="muted">{t(`stepIntros.${step}`)}</Text>
      </View>

      {errorCount ? (
        <Notice tone="error">{t("fixErrors", { count: errorCount })}</Notice>
      ) : null}
      {serverError ? <Notice tone="error">{serverError}</Notice> : null}

      {step === "type" ? (
        <View style={styles.gapMd}>
          {MEMBER_TYPES.map((type) => (
            <ChoiceCard
              key={type}
              selected={state.types.includes(type)}
              onPress={() => toggleType(type)}
              icon={<Text variant="heading">{TYPE_ICON[type]}</Text>}
              title={t(`types.${type}.title`)}
              description={t(`types.${type}.description`)}
            />
          ))}
          <Text variant="small" tone="muted">
            {t("hints.types")}
          </Text>
          {err("types") ? (
            <Text variant="small" tone="danger">
              {err("types")}
            </Text>
          ) : null}
        </View>
      ) : null}

      {step === "basics" ? (
        <View style={styles.gapLg}>
          <View style={styles.gapMd}>
            <FieldLabel label={t("fields.nameRomaji")} />
            <Text variant="small" tone="muted">
              {t("hints.nameRomaji")}
            </Text>
            <FormText
              label={t("fields.lastNameRomaji")}
              autoComplete="family-name"
              textContentType="familyName"
              value={state.lastNameRomaji}
              onChangeText={(v) => set("lastNameRomaji", v)}
              error={err("lastNameRomaji")}
            />
            <FormText
              label={t("fields.firstNameRomaji")}
              autoComplete="given-name"
              textContentType="givenName"
              value={state.firstNameRomaji}
              onChangeText={(v) => set("firstNameRomaji", v)}
              error={err("firstNameRomaji")}
            />
            <FormText
              label={t("fields.middleNameRomaji")}
              optional
              autoComplete="additional-name"
              textContentType="middleName"
              value={state.middleNameRomaji}
              onChangeText={(v) => set("middleNameRomaji", v)}
              error={err("middleNameRomaji")}
            />
          </View>
          <View style={styles.gapMd}>
            <FieldLabel
              label={t("fields.nameKanji")}
              extra={
                <View style={styles.recommended}>
                  <Text variant="caption" weight="medium" style={styles.amber}>
                    {t("recommended")}
                  </Text>
                </View>
              }
            />
            <Text variant="small" tone="muted">
              {t("hints.nameKanji")}
            </Text>
            <FormText
              label={t("fields.lastNameKanji")}
              optional
              value={state.lastNameKanji}
              onChangeText={(v) => set("lastNameKanji", v)}
              error={err("lastNameKanji")}
            />
            <FormText
              label={t("fields.firstNameKanji")}
              optional
              value={state.firstNameKanji}
              onChangeText={(v) => set("firstNameKanji", v)}
              error={err("firstNameKanji")}
            />
            <FormText
              label={t("fields.lastNameKana")}
              optional={!state.lastNameKanji.trim()}
              placeholder={t("placeholders.lastNameKana")}
              value={state.lastNameKana}
              onChangeText={(v) => set("lastNameKana", v)}
              error={err("lastNameKana")}
            />
            <FormText
              label={t("fields.firstNameKana")}
              optional={!state.firstNameKanji.trim()}
              placeholder={t("placeholders.firstNameKana")}
              value={state.firstNameKana}
              onChangeText={(v) => set("firstNameKana", v)}
              error={err("firstNameKana")}
            />
          </View>
          <FormText
            label={t("fields.nameAtAis")}
            optional
            hint={t("hints.nameAtAis")}
            value={state.nameAtAis}
            onChangeText={(v) => set("nameAtAis", v)}
            error={err("nameAtAis")}
          />
          <DateField
            label={t("fields.dateOfBirth")}
            hint={t("hints.dateOfBirth")}
            value={state.dateOfBirth}
            onChangeText={(v) => set("dateOfBirth", v)}
            error={err("dateOfBirth")}
          />
          <Select
            label={t("fields.gender")}
            hint={t("hints.gender")}
            error={err("gender")}
            value={state.gender}
            onChange={(v) => set("gender", v)}
            placeholder={t("choose")}
            options={GENDERS.map((g) => ({
              value: g,
              label: tg(`genders.${g}`),
            }))}
          />
          <Select
            label={t("fields.locale")}
            hint={t("hints.locale")}
            value={state.locale}
            onChange={(v) => set("locale", v === "en" ? "en" : "ja")}
            placeholder={t("choose")}
            options={[
              { value: "ja", label: "日本語" },
              { value: "en", label: "English" },
            ]}
          />
        </View>
      ) : null}

      {step === "details" ? (
        <View style={styles.gapLg}>
          {isStudent && registeredByParent ? (
            <Notice tone="warning" title={t("parentRegistered.title")}>
              {t("parentRegistered.body")}
            </Notice>
          ) : null}
          {isStudent ? (
            <StudentSection
              value={state.student}
              onChange={(v) => set("student", v)}
              errors={errors}
              cohorts={data.cohorts}
            />
          ) : null}
          {state.types.includes("PARENT") ? (
            <ParentSection
              value={state.parent}
              onChange={(v) => set("parent", v)}
              errors={errors}
              cohorts={data.cohorts}
            />
          ) : null}
          {state.types.includes("TEACHER") ? (
            <TeacherSection
              value={state.teacher}
              onChange={(v) => set("teacher", v)}
              errors={errors}
              verifiedEmail={verifiedEmail}
              onVerified={setVerifiedEmail}
            />
          ) : null}
          {["student", "parent", "teacher"].map((p) =>
            err(p) ? (
              <Text key={p} variant="small" tone="danger">
                {err(p)}
              </Text>
            ) : null,
          )}
        </View>
      ) : null}

      {step === "review" ? (
        <View style={styles.gapLg}>
          {/* Not required, but it's how Japanese classmates search. */}
          {!kanji ? (
            <Notice tone="warning" title={t("kanjiReminder.title")}>
              <Text variant="small" style={styles.amber}>
                {t("kanjiReminder.body")}
              </Text>
              <Button
                variant="ghost"
                compact
                label={t("kanjiReminder.action")}
                onPress={() => goTo(STEPS.indexOf("basics"))}
                style={styles.start}
              />
            </Notice>
          ) : null}
          <View style={styles.review}>
            <Text weight="semibold" accessibilityRole="header">
              {t("review.title")}
            </Text>
            <Fact
              label={t("fields.nameRomaji")}
              value={composeRomaji(state) ?? ""}
            />
            {kanji ? (
              <Fact label={t("fields.nameKanji")} value={kanji} />
            ) : null}
            <Fact label={t("fields.dateOfBirth")} value={state.dateOfBirth} />
            <Fact
              label={t("fields.gender")}
              value={state.gender ? tg(`genders.${state.gender}`) : "—"}
            />
            <Fact
              label={t("review.types")}
              value={joinList(
                state.types.map((x) => t(`types.${x}.title`)),
                uiLocale,
              )}
            />
            {isStudent ? (
              <Fact
                label={t("fields.cohort")}
                value={
                  data.cohorts.find(
                    (c) => c.value === state.student.cohortNumber,
                  )?.label ?? "—"
                }
              />
            ) : null}
            {state.types.includes("PARENT") ? (
              <Fact
                label={t("review.children")}
                value={joinList(
                  state.parent.children.map((c) => c.name),
                  uiLocale,
                )}
              />
            ) : null}
            <Button
              variant="ghost"
              compact
              label={t("review.edit")}
              onPress={() => goTo(0)}
              style={styles.start}
            />
          </View>

          {isGraduate ? (
            <View style={styles.diploma}>
              <View style={styles.row}>
                <GraduationCap size={20} color={colors.brand700} aria-hidden />
                <Text weight="semibold" accessibilityRole="header">
                  {t("diploma.title")}
                  {state.diplomaUnavailable ? null : (
                    <Text tone="danger"> *</Text>
                  )}
                </Text>
              </View>
              <Text variant="small" tone="muted">
                {t("diploma.intro")}
              </Text>
              {state.diplomaUnavailable ? null : (
                <EvidenceUploader
                  kind="DIPLOMA"
                  max={1}
                  label={t("diploma.label")}
                  hint={t("diploma.hint")}
                  items={diplomaItems}
                  onChange={(items) =>
                    set("evidence", [...otherItems, ...items])
                  }
                  error={err("evidence")}
                />
              )}
              {err("diploma") ? (
                <Text variant="small" tone="danger">
                  {err("diploma")}
                </Text>
              ) : null}
              <Checkbox
                checked={state.diplomaUnavailable}
                onChange={(v) => set("diplomaUnavailable", v)}
                label={t("diploma.unavailable")}
                hint={t("diploma.unavailableHint")}
              />
            </View>
          ) : null}

          <Details
            summary={t("review.addDocuments")}
            initiallyOpen={
              otherItems.length > 0 || (isGraduate && state.diplomaUnavailable)
            }
          >
            <EvidenceUploader
              items={otherItems}
              onChange={(items) => set("evidence", [...diplomaItems, ...items])}
              error={err("evidence")}
            />
          </Details>
          <Text variant="small" tone="muted">
            {t("review.note")}
          </Text>
        </View>
      ) : null}

      <View style={styles.nav}>
        {stepIndex > 0 ? (
          <Button
            variant="secondary"
            label={t("back")}
            disabled={submitting}
            onPress={() => goTo(stepIndex - 1)}
          />
        ) : (
          <View />
        )}
        {step === "review" ? (
          <Button
            label={submitting ? t("submitting") : t("submit")}
            loading={submitting}
            onPress={submit}
          />
        ) : (
          <Button label={t("next")} onPress={next} />
        )}
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="small" tone="muted" style={styles.factLabel}>
        {label}
      </Text>
      <Text variant="small" style={styles.flex}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: space.xl },
  gapSm: { gap: space.xs },
  gapMd: { gap: space.md },
  gapLg: { gap: space.xl },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  start: { alignSelf: "flex-start" },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.slate200,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.brand700,
  },
  steps: { flexDirection: "row", gap: space.xs },
  recommended: {
    borderRadius: radius.full,
    backgroundColor: colors.amber100,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  amber: { color: colors.amber900 },
  review: {
    gap: space.sm,
    backgroundColor: colors.slate100,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  fact: { flexDirection: "row", gap: space.md },
  factLabel: { width: 110 },
  diploma: {
    gap: space.md,
    borderWidth: 2,
    borderColor: colors.brand200,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: space.lg,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
