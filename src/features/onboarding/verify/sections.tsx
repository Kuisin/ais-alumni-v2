import type { RegisteredChild } from "@contract/onboarding";
import { Check, Search, UserCheck, UserPlus } from "lucide-react-native";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ApiError, api } from "@/lib/api";
import {
  Badge,
  Button,
  colors,
  Loading,
  radius,
  space,
  Text,
  TextField,
} from "@/ui";
import {
  ChoiceCard,
  DateField,
  FieldLabel,
  FormText,
  YearField,
} from "../controls";
import {
  CohortPicker,
  Details,
  num,
  Preview,
  TypeSection,
  useErrorText,
  useStudentPreview,
} from "./fields";
import {
  type ChildMode,
  type ChildState,
  type CohortChoice,
  type Errors,
  emptyChild,
  isCurrentTeacher,
  MAX_CHILDREN,
  type VerifyFormState,
} from "./rules";

type SectionProps<K extends keyof VerifyFormState> = {
  value: VerifyFormState[K];
  onChange: (v: VerifyFormState[K]) => void;
  errors: Errors;
};

export function StudentSection({
  value,
  onChange,
  errors,
  cohorts,
}: SectionProps<"student"> & { cohorts: CohortChoice[] }) {
  const t = useTranslations("verify");
  const err = useErrorText(errors);
  const preview = useStudentPreview()(value.cohortNumber, value.leftYear);
  const set = (patch: Partial<VerifyFormState["student"]>) =>
    onChange({ ...value, ...patch });
  return (
    <TypeSection
      icon="🎓"
      title={t("types.STUDENT.title")}
      intro={t("sections.student")}
    >
      <CohortPicker
        path="student.cohortNumber"
        value={value.cohortNumber}
        onChange={(v) => set({ cohortNumber: v })}
        errors={errors}
        cohorts={cohorts}
        required
      />
      <YearField
        label={t("fields.joinedYear")}
        value={value.joinedYear}
        onChangeText={(v) => set({ joinedYear: v })}
        error={err("student.joinedYear")}
      />
      <YearField
        label={t("fields.leftYearStudent")}
        optional
        hint={t("hints.leftYearStudent")}
        value={value.leftYear}
        onChangeText={(v) => set({ leftYear: v })}
        error={err("student.leftYear")}
      />
      {preview ? <Preview>{preview}</Preview> : null}
      <Details summary={t("sections.studentMore")}>
        <Text variant="small" tone="muted">
          {t("hints.classmates")}
        </Text>
        <FormText
          label={t("fields.classmateN", { n: 1 })}
          optional
          value={value.classmates[0]}
          onChangeText={(v) => set({ classmates: [v, value.classmates[1]] })}
          error={err("student.classmates.0")}
        />
        <FormText
          label={t("fields.classmateN", { n: 2 })}
          optional
          value={value.classmates[1]}
          onChangeText={(v) => set({ classmates: [value.classmates[0], v] })}
          error={err("student.classmates.1")}
        />
        <FormText
          label={t("fields.homeroomTeacher")}
          optional
          value={value.homeroomTeacher}
          onChangeText={(v) => set({ homeroomTeacher: v })}
          error={err("student.homeroomTeacher")}
        />
        <FormText
          label={t("fields.studentIdNo")}
          optional
          value={value.studentIdNo}
          onChangeText={(v) => set({ studentIdNo: v })}
          error={err("student.studentIdNo")}
        />
      </Details>
    </TypeSection>
  );
}

export function ParentSection({
  value,
  onChange,
  errors,
  cohorts,
}: SectionProps<"parent"> & { cohorts: CohortChoice[] }) {
  const t = useTranslations("verify");
  const err = useErrorText(errors);
  const children = value.children;
  // Stable row keys so removing a middle child doesn't shuffle inputs.
  const next = useRef(children.length);
  const [ids, setIds] = useState(() => children.map((_, i) => i));
  const update = (i: number, patch: Partial<ChildState>) =>
    onChange({
      children: children.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    });
  return (
    <TypeSection
      icon="👪"
      title={t("types.PARENT.title")}
      intro={t("sections.parent")}
    >
      <Text variant="small" tone="muted">
        {t("child.reviewNote")}
      </Text>
      {children.map((c, i) => (
        <ChildRow
          key={ids[i] ?? `child-${i}`}
          index={i}
          value={c}
          onChange={(patch) => update(i, patch)}
          onRemove={
            children.length > 1
              ? () => {
                  setIds(ids.filter((_, j) => j !== i));
                  onChange({ children: children.filter((_, j) => j !== i) });
                }
              : null
          }
          errors={errors}
          cohorts={cohorts}
        />
      ))}
      {err("parent.children") ? (
        <Text variant="small" tone="danger">
          {err("parent.children")}
        </Text>
      ) : null}
      {children.length < MAX_CHILDREN ? (
        <Button
          variant="secondary"
          label={t("addChild")}
          icon={(c) => <UserPlus size={16} color={c} />}
          onPress={() => {
            setIds([...ids, next.current++]);
            onChange({ children: [...children, emptyChild()] });
          }}
        />
      ) : null}
    </TypeSection>
  );
}

const MODES: { mode: ChildMode; Icon: typeof UserCheck }[] = [
  // Existing first: linking a registered child avoids a duplicate record.
  { mode: "existing", Icon: UserCheck },
  { mode: "new", Icon: UserPlus },
];

/**
 * One child: pick an already-registered member (exact name + birth date
 * search) or enter a new child's details.
 */
function ChildRow({
  index,
  value,
  onChange,
  onRemove,
  errors,
  cohorts,
}: {
  index: number;
  value: ChildState;
  onChange: (patch: Partial<ChildState>) => void;
  onRemove: (() => void) | null;
  errors: Errors;
  cohorts: CohortChoice[];
}) {
  const t = useTranslations("verify");
  const base = `parent.children.${index}`;
  return (
    <View style={styles.child}>
      <View style={styles.childHead}>
        <Text weight="semibold" accessibilityRole="header" style={styles.flex}>
          {t("childN", { n: index + 1 })}
        </Text>
        {onRemove ? (
          <Button
            variant="ghost"
            compact
            label={t("removeChild")}
            accessibilityLabel={t("removeChildN", { n: index + 1 })}
            onPress={onRemove}
          />
        ) : null}
      </View>
      <FieldLabel label={t("child.modeLegend")} />
      <View style={styles.gap}>
        {MODES.map(({ mode, Icon }) => (
          <ChoiceCard
            key={mode}
            role="radio"
            selected={value.mode === mode}
            onPress={() => onChange({ mode })}
            icon={
              <Icon
                size={20}
                color={value.mode === mode ? colors.brand700 : colors.slate500}
                aria-hidden
              />
            }
            title={t(`child.modes.${mode}.title`)}
            description={t(`child.modes.${mode}.description`)}
          />
        ))}
      </View>
      {value.mode === "existing" ? (
        <ExistingChild
          base={base}
          value={value}
          onChange={onChange}
          errors={errors}
        />
      ) : (
        <NewChild
          base={base}
          value={value}
          onChange={onChange}
          errors={errors}
          cohorts={cohorts}
        />
      )}
    </View>
  );
}

type ChildArgs = {
  base: string;
  value: ChildState;
  onChange: (patch: Partial<ChildState>) => void;
  errors: Errors;
};

function ExistingChild({ base, value, onChange, errors }: ChildArgs) {
  const t = useTranslations("verify");
  const err = useErrorText(errors);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [results, setResults] = useState<RegisteredChild[] | null>(null);
  const [problem, setProblem] = useState<"incomplete" | "failed" | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const error = err(`${base}.existingUserId`) ?? err(`${base}.name`);

  const search = async () => {
    if (name.trim().length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setProblem("incomplete");
      setResults(null);
      return;
    }
    setProblem(null);
    setPending(true);
    try {
      const r = await api<{ children: RegisteredChild[] }>(
        "/onboarding/verify/children/search",
        { body: { name, dateOfBirth: dob } },
      );
      setResults(r.children);
    } catch {
      setResults(null);
      setProblem("failed");
    } finally {
      setPending(false);
    }
  };

  if (value.existingUserId)
    return (
      <View style={styles.gap}>
        <View style={styles.picked}>
          <Check size={20} color={colors.brand700} aria-hidden />
          <View style={styles.flex}>
            <Text
              weight="semibold"
              accessibilityLabel={`${t("child.selected")}: ${value.name}`}
            >
              {value.name}
            </Text>
            {picked ? (
              <Text variant="small" tone="muted">
                {picked}
              </Text>
            ) : null}
          </View>
          <Button
            variant="ghost"
            compact
            label={t("child.change")}
            accessibilityLabel={t("child.changeNamed", { name: value.name })}
            onPress={() => onChange({ existingUserId: "", name: "" })}
          />
        </View>
        <Text variant="small" tone="muted">
          {t("child.confirmNote")}
        </Text>
      </View>
    );

  return (
    <View style={styles.gap}>
      <Text variant="small" tone="muted">
        {t("child.searchIntro")}
      </Text>
      <FormText
        label={t("child.searchName")}
        hint={t("child.searchNameHint")}
        error={error}
        autoComplete="off"
        maxLength={100}
        value={name}
        onChangeText={setName}
        returnKeyType="search"
        onSubmitEditing={search}
      />
      <DateField
        label={t("child.dateOfBirth")}
        value={dob}
        onChangeText={setDob}
      />
      <Button
        variant="secondary"
        label={t("child.find")}
        disabled={pending}
        icon={(c) => <Search size={16} color={c} />}
        onPress={search}
      />
      <View accessibilityLiveRegion="polite">
        {pending ? (
          <Loading inline />
        ) : problem ? (
          <Text variant="small" tone="danger">
            {t(
              problem === "failed"
                ? "child.searchFailed"
                : "child.searchIncomplete",
            )}
          </Text>
        ) : results ? (
          <Text variant="small">
            {results.length
              ? t("child.found", { count: results.length })
              : t("child.notFound")}
          </Text>
        ) : null}
      </View>
      {!pending && results?.length
        ? results.map((r) => (
            <ChoiceCard
              key={r.id}
              role="radio"
              selected={false}
              title={r.name}
              description={r.cohort ?? undefined}
              onPress={() => {
                setPicked(r.cohort);
                onChange({ existingUserId: r.id, name: r.name });
              }}
            />
          ))
        : null}
      {!pending && results && results.length === 0 ? (
        <Button
          variant="ghost"
          label={t("child.switchToNew")}
          icon={(c) => <UserPlus size={16} color={c} />}
          onPress={() =>
            onChange({ mode: "new", dateOfBirth: value.dateOfBirth || dob })
          }
        />
      ) : null}
      <Text variant="small" tone="muted">
        {t("child.confirmNote")}
      </Text>
    </View>
  );
}

function NewChild({
  base,
  value,
  onChange,
  errors,
  cohorts,
}: ChildArgs & { cohorts: CohortChoice[] }) {
  const t = useTranslations("verify");
  const ph = useTranslations("common.names.placeholders");
  const err = useErrorText(errors);
  const preview = useStudentPreview()(value.cohortNumber, value.leftYear);
  const text = (
    key: keyof ChildState,
    label: string,
    opts: { optional?: boolean; placeholder?: string } = {},
  ) => (
    <FormText
      label={label}
      optional={opts.optional}
      placeholder={opts.placeholder}
      autoComplete="off"
      maxLength={50}
      value={value[key] as string}
      onChangeText={(v) => onChange({ [key]: v })}
      error={err(`${base}.${key}`)}
    />
  );
  return (
    <View style={styles.gap}>
      <Text variant="small" tone="muted">
        {t("child.newIntro")}
      </Text>
      <FieldLabel label={t("child.nameRomaji")} />
      {text("lastNameRomaji", t("fields.lastNameRomaji"), {
        placeholder: ph("lastNameRomaji"),
      })}
      {text("firstNameRomaji", t("fields.firstNameRomaji"), {
        placeholder: ph("firstNameRomaji"),
      })}
      <FieldLabel label={t("child.nameKanji")} />
      {text("lastNameKanji", t("fields.lastNameKanji"), {
        optional: true,
        placeholder: ph("lastNameKanji"),
      })}
      {text("firstNameKanji", t("fields.firstNameKanji"), {
        optional: true,
        placeholder: ph("firstNameKanji"),
      })}
      {text("lastNameKana", t("fields.lastNameKana"), {
        optional: !value.lastNameKanji.trim(),
        placeholder: t("placeholders.lastNameKana"),
      })}
      {text("firstNameKana", t("fields.firstNameKana"), {
        optional: !value.firstNameKanji.trim(),
        placeholder: t("placeholders.firstNameKana"),
      })}
      <DateField
        label={t("child.dateOfBirth")}
        value={value.dateOfBirth}
        onChangeText={(v) => onChange({ dateOfBirth: v })}
        error={err(`${base}.dateOfBirth`)}
      />
      <CohortPicker
        path={`${base}.cohortNumber`}
        value={value.cohortNumber}
        onChange={(v) => onChange({ cohortNumber: v })}
        errors={errors}
        cohorts={cohorts}
        required
      />
      <YearField
        label={t("child.joinedYear")}
        value={value.joinedYear}
        onChangeText={(v) => onChange({ joinedYear: v })}
        error={err(`${base}.joinedYear`)}
      />
      <YearField
        label={t("child.leftYear")}
        optional
        hint={t("child.leftYearHint")}
        value={value.leftYear}
        onChangeText={(v) => onChange({ leftYear: v })}
        error={err(`${base}.leftYear`)}
      />
      {preview ? <Preview>{preview}</Preview> : null}
      {text("studentIdNo", t("fields.studentIdNo"), { optional: true })}
    </View>
  );
}

export function TeacherSection({
  value,
  onChange,
  errors,
  verifiedEmail,
  onVerified,
}: SectionProps<"teacher"> & {
  verifiedEmail: string | null;
  onVerified: (email: string) => void;
}) {
  const t = useTranslations("verify");
  const err = useErrorText(errors);
  const set = (patch: Partial<VerifyFormState["teacher"]>) =>
    onChange({ ...value, ...patch });
  const joined = num(value.joinedYear);
  const left = num(value.leftYear);
  return (
    <TypeSection
      icon="🧑‍🏫"
      title={t("types.TEACHER.title")}
      intro={t("sections.teacher")}
    >
      <YearField
        label={t("fields.joinedYearTeacher")}
        value={value.joinedYear}
        onChangeText={(v) => set({ joinedYear: v })}
        error={err("teacher.joinedYear")}
      />
      <YearField
        label={t("fields.leftYearTeacher")}
        optional
        hint={t("hints.leftYearTeacher")}
        value={value.leftYear}
        onChangeText={(v) => set({ leftYear: v })}
        error={err("teacher.leftYear")}
      />
      {joined ? (
        <Preview>
          {isCurrentTeacher(left)
            ? t("preview.teacherCurrent")
            : t("preview.teacherFormer", { year: left ?? "" })}
        </Preview>
      ) : null}
      <FormText
        label={t("fields.subjects")}
        hint={t("hints.subjects")}
        value={value.subjects}
        onChangeText={(v) => set({ subjects: v })}
        error={err("teacher.subjects")}
      />
      <SchoolEmail
        value={value.schoolEmail}
        onChange={(v) => set({ schoolEmail: v })}
        verifiedEmail={verifiedEmail}
        onVerified={onVerified}
        error={err("teacher.schoolEmail")}
        // Required (and confirmed) while they still work at AIS.
        optional={!isCurrentTeacher(left)}
      />
    </TypeSection>
  );
}

/**
 * Teacher school email (@aisnagoya.net) with code confirmation (§6.2): the
 * confirmed code is recorded server-side and submitting reads it.
 */
function SchoolEmail({
  value,
  onChange,
  verifiedEmail,
  onVerified,
  error,
  optional,
}: {
  value: string;
  onChange: (v: string) => void;
  verifiedEmail: string | null;
  onVerified: (email: string) => void;
  error: string | null;
  optional: boolean;
}) {
  const t = useTranslations("verify");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const email = value.trim().toLowerCase();
  const verified = !!email && verifiedEmail === email;

  const failed = (e: unknown) =>
    setMessage({
      tone: "danger",
      text: t(
        `schoolEmail.errors.${e instanceof ApiError && e.status === 400 ? e.code : "invalid"}`,
      ),
    });

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api("/onboarding/verify/school-email/send", { body: { email } });
      setSentTo(email);
      setMessage({ tone: "success", text: t("schoolEmail.sent", { email }) });
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api("/onboarding/verify/school-email/confirm", {
        body: { email, code },
      });
      onVerified(email);
      setSentTo(null);
      setCode("");
      setMessage({ tone: "success", text: t("schoolEmail.verified") });
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gap}>
      <FieldLabel
        label={t("fields.schoolEmail")}
        optional={optional}
        extra={
          verified ? (
            <Badge tone="green" label={t("schoolEmail.verifiedBadge")} />
          ) : null
        }
      />
      <TextField
        accessibilityLabel={t("fields.schoolEmail")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        placeholder="name@aisnagoya.net"
        value={value}
        onChangeText={onChange}
        hint={t("hints.schoolEmail")}
        error={error}
      />
      {verified ? null : (
        <Button
          variant="secondary"
          label={
            sentTo === email ? t("schoolEmail.resend") : t("schoolEmail.send")
          }
          disabled={busy || !email}
          onPress={send}
        />
      )}
      {sentTo && sentTo === email && !verified ? (
        <View style={styles.gap}>
          <TextField
            label={t("schoolEmail.codeLabel")}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
          />
          <Button
            label={t("schoolEmail.confirm")}
            disabled={busy || code.length !== 6}
            onPress={confirm}
          />
        </View>
      ) : null}
      {message ? (
        <Text
          variant="small"
          tone={message.tone}
          accessibilityLiveRegion="polite"
        >
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  child: {
    gap: space.md,
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: space.md,
  },
  childHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  picked: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 2,
    borderColor: colors.brand700,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: space.md,
  },
});
