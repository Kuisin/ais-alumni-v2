import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { CalendarClock, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { formatDateTime, TIME_ZONE } from "@/lib/format";
import { Button, colors, radius, space, Text, TOUCH } from "@/ui";
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
 * A date and time in Japan time (the website's datetime-local fields).
 * Native: the system picker (Android: date, then time; iOS: in a sheet),
 * always showing Japan time whatever the phone's time zone.
 */
export function DateTimeField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  min,
}: DateTimeFieldProps) {
  const t = useTranslations("mobile.compose");
  const locale = useLocale() === "en" ? "en" : "ja";
  const current = fromJstLocal(value);
  const [draft, setDraft] = useState<Date | null>(null);

  const open = () => {
    const start = current ?? nextHour();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: start,
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
      return;
    }
    setDraft(start);
  };

  return (
    <View style={styles.wrap}>
      <Text variant="small" weight="semibold">
        {label}
        {required ? <Text tone="danger"> *</Text> : null}
      </Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${current ? formatDateTime(current, locale) : t("dateNotSet")}`}
          accessibilityHint={t("dateChoose")}
          onPress={open}
          style={({ pressed }) => [
            styles.input,
            error ? styles.invalid : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <CalendarClock size={18} color={colors.slate500} aria-hidden />
          <Text tone={current ? "default" : "subtle"} style={styles.flex}>
            {current ? formatDateTime(current, locale) : t("dateNotSet")}
          </Text>
        </Pressable>
        {current && !required ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("dateClear", { label })}
            onPress={() => onChange("")}
            hitSlop={4}
            style={styles.clear}
          >
            <X size={18} color={colors.slate500} aria-hidden />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
      {draft ? (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setDraft(null)}
        >
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <Text variant="subheading" accessibilityRole="header">
                {label}
              </Text>
              <DateTimePicker
                value={draft}
                mode="datetime"
                display="inline"
                minimumDate={min}
                timeZoneName={TIME_ZONE}
                locale={locale === "ja" ? "ja-JP" : "en-US"}
                accentColor={colors.brand700}
                onChange={(_, d) => d && setDraft(d)}
              />
              <View style={styles.actions}>
                <Button
                  variant="secondary"
                  label={t("cancel")}
                  onPress={() => setDraft(null)}
                  style={styles.flex}
                />
                <Button
                  label={t("done")}
                  onPress={() => {
                    onChange(toJstLocal(draft));
                    setDraft(null);
                  }}
                  style={styles.flex}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  actions: { flexDirection: "row", gap: space.sm },
});
