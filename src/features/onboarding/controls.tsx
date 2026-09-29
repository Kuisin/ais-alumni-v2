import { Check, ChevronDown, X } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { colors, radius, space, Text, TextField, TOUCH } from "@/ui";

/**
 * Form controls the application and お問い合わせ need beyond `TextField`:
 * a label with 必須 / 任意, a picker (the website's <select>), check boxes,
 * choice cards, notices and a YYYY-MM-DD date field. They work the same on
 * iOS, Android and the web.
 */

export function FieldLabel({
  label,
  optional,
  extra,
}: {
  label: string;
  /** shows 「（任意）」 like the website's OptionalLabel */
  optional?: boolean;
  extra?: ReactNode;
}) {
  const t = useTranslations("verify");
  return (
    <View style={styles.labelRow}>
      <Text variant="small" weight="semibold">
        {label}
        {optional ? (
          <Text variant="small" tone="subtle">
            {` (${t("optional")})`}
          </Text>
        ) : null}
      </Text>
      {extra}
    </View>
  );
}

function HintOrError({
  hint,
  error,
}: {
  hint?: string | null;
  error?: string | null;
}) {
  if (error)
    return (
      <Text variant="small" tone="danger" accessibilityRole="alert">
        {error}
      </Text>
    );
  if (hint)
    return (
      <Text variant="caption" tone="subtle">
        {hint}
      </Text>
    );
  return null;
}

/** A text field with the website's 任意 label and hint / error text. */
export function FormText({
  label,
  optional,
  hint,
  error,
  ...props
}: Omit<Parameters<typeof TextField>[0], "label"> & {
  label: string;
  optional?: boolean;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} optional={optional} />
      <TextField
        {...props}
        accessibilityLabel={label}
        error={error}
        hint={hint ?? undefined}
      />
    </View>
  );
}

/** Four-digit year (the website's YearInput). */
export function YearField(
  props: Omit<Parameters<typeof FormText>[0], "keyboardType" | "maxLength">,
) {
  return (
    <FormText
      keyboardType="number-pad"
      maxLength={4}
      placeholder="2015"
      {...props}
      onChangeText={(v) => props.onChangeText?.(v.replace(/\D/g, ""))}
    />
  );
}

/**
 * A date as YYYY-MM-DD (what the website's <input type="date"> sends):
 * digits only, the hyphens are added while typing.
 */
export function DateField(
  props: Omit<Parameters<typeof FormText>[0], "keyboardType" | "maxLength">,
) {
  return (
    <FormText
      keyboardType="number-pad"
      maxLength={10}
      placeholder="YYYY-MM-DD"
      autoComplete="off"
      {...props}
      onChangeText={(v) => {
        const d = v.replace(/\D/g, "").slice(0, 8);
        const out =
          d.length > 6
            ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`
            : d.length > 4
              ? `${d.slice(0, 4)}-${d.slice(4)}`
              : d;
        props.onChangeText?.(out);
      }}
    />
  );
}

export type Option = { value: string; label: string };

/**
 * The website's <select>: a button showing the choice that opens a list.
 * `placeholder` is the empty option (「選択してください」…), which can be
 * picked again when `clearable`.
 */
export function Select({
  label,
  optional,
  hint,
  error,
  value,
  options,
  onChange,
  placeholder,
  clearable = false,
  disabled = false,
}: {
  label: string;
  optional?: boolean;
  hint?: string | null;
  error?: string | null;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder: string;
  clearable?: boolean;
  disabled?: boolean;
}) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const all = clearable
    ? [{ value: "", label: placeholder }, ...options]
    : options;
  return (
    <View style={styles.field}>
      <FieldLabel label={label} optional={optional} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.select,
          error ? styles.invalid : null,
          disabled ? styles.disabled : null,
        ]}
      >
        <Text
          tone={current ? "default" : "subtle"}
          style={styles.flex}
          numberOfLines={1}
        >
          {current?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color={colors.slate500} aria-hidden />
      </Pressable>
      <HintOrError hint={hint} error={error} />
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
        transparent={Platform.OS === "web"}
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
          <View style={styles.sheetHead}>
            <Text
              variant="subheading"
              accessibilityRole="header"
              style={styles.flex}
            >
              {label}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tc("close")}
              onPress={() => setOpen(false)}
              style={styles.close}
            >
              <X size={22} color={colors.slate600} aria-hidden />
            </Pressable>
          </View>
          <FlatList
            data={all}
            keyExtractor={(o) => o.value || "_empty"}
            initialScrollIndex={Math.max(
              0,
              all.findIndex((o) => o.value === value),
            )}
            getItemLayout={(_, index) => ({
              length: ROW,
              offset: ROW * index,
              index,
            })}
            renderItem={({ item }) => {
              const on = item.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text
                    style={styles.flex}
                    weight={on ? "semibold" : "regular"}
                    tone={item.value ? "default" : "muted"}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {on ? (
                    <Check size={18} color={colors.brand700} aria-hidden />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const ROW = 52;

/** A check box row (label and an optional second line). */
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked ? styles.boxOn : null]}>
        {checked ? (
          <Check size={16} color={colors.white} strokeWidth={3} aria-hidden />
        ) : null}
      </View>
      <View style={styles.flex}>
        <Text variant="small">{label}</Text>
        {hint ? (
          <Text variant="small" tone="subtle">
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A large selectable card (the application's type and child-mode choices). */
export function ChoiceCard({
  selected,
  onPress,
  title,
  description,
  icon,
  role = "checkbox",
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  role?: "checkbox" | "radio";
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={onPress}
      style={[styles.choice, selected ? styles.choiceOn : null]}
    >
      {icon ? <View style={styles.choiceIcon}>{icon}</View> : null}
      <View style={styles.flex}>
        <Text weight="semibold">{title}</Text>
        {description ? (
          <Text variant="small" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.box, selected ? styles.boxOn : null]}>
        {selected ? (
          <Check size={16} color={colors.white} strokeWidth={3} aria-hidden />
        ) : null}
      </View>
    </Pressable>
  );
}

const NOTICE = {
  info: { bg: colors.brand50, border: colors.brand100, fg: colors.brand800 },
  warning: { bg: colors.amber50, border: colors.amber100, fg: colors.amber900 },
  error: { bg: colors.red50, border: colors.red100, fg: colors.red700 },
  success: { bg: colors.green50, border: colors.green100, fg: colors.green700 },
} as const;

/** The website's Alert. */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof NOTICE;
  title?: string;
  children?: ReactNode;
}) {
  const c = NOTICE[tone];
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: c.bg, borderColor: c.border }]}
    >
      {title ? (
        <Text variant="small" weight="semibold" style={{ color: c.fg }}>
          {title}
        </Text>
      ) : null}
      {typeof children === "string" ? (
        <Text variant="small" style={{ color: c.fg }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: space.xs },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.sm,
  },
  select: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
  },
  invalid: { borderColor: colors.red600 },
  disabled: { backgroundColor: colors.slate100 },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    ...(Platform.OS === "web"
      ? {
          marginTop: 64,
          width: "100%",
          maxWidth: 560,
          alignSelf: "center",
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          boxShadow: "0 -4px 24px rgba(15, 23, 42, 0.2)",
        }
      : null),
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  close: {
    minWidth: TOUCH,
    minHeight: TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  option: {
    height: ROW,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.slate100 },
  checkRow: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.xs,
  },
  box: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.slate400,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  boxOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  choice: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  choiceOn: { borderColor: colors.brand700, backgroundColor: colors.brand50 },
  choiceIcon: { width: 32, alignItems: "center" },
  notice: {
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
});
