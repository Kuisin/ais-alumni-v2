import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { CalendarClock, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { formatDateTime, TIME_ZONE } from "@/lib/format";
import { colors, radius, space, Text, TOUCH } from "@/ui";
import { fromJstLocal, nextHour, toJstLocal } from "./jst";

export type DateTimeFieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  /** "YYYY-MM-DDTHH:mm" in Japan time, "" = not set */
  value: string;
  onChange: (value: string) => void;
  /** earliest choice */
  min?: Date;
};

/**
 * A date and time in Japan time (the website's datetime-local fields),
 * always showing Japan time whatever the phone's time zone. iOS: the
 * system's compact picker in the field (its date and time open the
 * system's own popover pickers); Android: the system dialogs, date then
 * time.
 */
export function DateTimeField(props: DateTimeFieldProps) {
  return Platform.OS === "ios" ? (
    <CompactField {...props} />
  ) : (
    <DialogField {...props} />
  );
}

function Frame({
  label,
  hint,
  error,
  required,
  children,
}: DateTimeFieldProps & { children: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <Text variant="small" weight="semibold">
        {label}
        {required ? <Text tone="danger"> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function ClearButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const t = useTranslations("mobile.compose");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("dateClear", { label })}
      onPress={onPress}
      hitSlop={4}
      style={styles.clear}
    >
      <X size={18} color={colors.slate500} aria-hidden />
    </Pressable>
  );
}

/** The field's face: the chosen date and time, or 未設定. */
function FieldButton({
  label,
  current,
  error,
  onPress,
}: {
  label: string;
  current: Date | null;
  error?: string | null;
  onPress: () => void;
}) {
  const t = useTranslations("mobile.compose");
  const locale = useLocale() === "en" ? "en" : "ja";
  const text = current ? formatDateTime(current, locale) : t("dateNotSet");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${text}`}
      accessibilityHint={t("dateChoose")}
      onPress={onPress}
      style={({ pressed }) => [
        styles.input,
        error ? styles.invalid : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <CalendarClock size={18} color={colors.slate500} aria-hidden />
      <Text tone={current ? "default" : "subtle"} style={styles.flex}>
        {text}
      </Text>
    </Pressable>
  );
}

/** iOS: the compact UIDatePicker once a value is set; 未設定 starts one. */
function CompactField(props: DateTimeFieldProps) {
  const { label, required, value, onChange, min } = props;
  const locale = useLocale() === "en" ? "en" : "ja";
  const current = fromJstLocal(value);
  return (
    <Frame {...props}>
      <View style={styles.row}>
        {current ? (
          <View
            style={[styles.compact, props.error ? styles.compactInvalid : null]}
          >
            <CalendarClock size={18} color={colors.slate500} aria-hidden />
            <DateTimePicker
              value={current}
              mode="datetime"
              display="compact"
              minimumDate={min}
              timeZoneName={TIME_ZONE}
              locale={locale === "ja" ? "ja-JP" : "en-US"}
              accentColor={colors.brand700}
              themeVariant="light"
              accessibilityLabel={label}
              onValueChange={(_, d) => onChange(toJstLocal(d))}
            />
          </View>
        ) : (
          <FieldButton
            label={label}
            current={null}
            error={props.error}
            onPress={() => {
              const start = nextHour();
              onChange(toJstLocal(min && start < min ? min : start));
            }}
          />
        )}
        {current && !required ? (
          <ClearButton label={label} onPress={() => onChange("")} />
        ) : null}
      </View>
    </Frame>
  );
}

/** Android: the system's date dialog, then its time dialog. */
function DialogField(props: DateTimeFieldProps) {
  const { label, required, value, onChange, min } = props;
  const current = fromJstLocal(value);

  const open = () => {
    DateTimePickerAndroid.open({
      value: current ?? nextHour(),
      mode: "date",
      minimumDate: min,
      timeZoneName: TIME_ZONE,
      onChange: (e, date) => {
        if (e.type !== "set" || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: "time",
          is24Hour: true,
          timeZoneName: TIME_ZONE,
          onChange: (e2, time) => {
            if (e2.type === "set" && time) onChange(toJstLocal(time));
          },
        });
      },
    });
  };

  return (
    <Frame {...props}>
      <View style={styles.row}>
        <FieldButton
          label={label}
          current={current}
          error={props.error}
          onPress={open}
        />
        {current && !required ? (
          <ClearButton label={label} onPress={() => onChange("")} />
        ) : null}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  input: {
    flex: 1,
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
  pressed: { backgroundColor: colors.slate50 },
  invalid: { borderColor: colors.red600 },
  clear: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  compact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: TOUCH,
  },
  compactInvalid: {
    borderWidth: 1,
    borderColor: colors.red600,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
  },
});
