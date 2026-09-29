import type { EventDetail, RsvpAnswer } from "@contract/events";
import * as Haptics from "expo-haptics";
import { Check, Pencil, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button, Card, colors, radius, space, Text, TOUCH } from "@/ui";
import { useRsvp, useRsvpErrorMessage } from "./api";
import { Notice } from "./parts";

const ANSWERS: RsvpAnswer[] = ["GOING", "MAYBE", "NOT_GOING"];

/**
 * 出欠の回答 (the website's RSVP card): why answering is closed or full,
 * the saved answer with 回答を変更 while open, or the form — which opens by
 * itself while nothing has been answered yet.
 */
export function RsvpCard({ event }: { event: EventDetail }) {
  const t = useTranslations("events");
  const { rsvp } = event;
  const [editing, setEditing] = useState(rsvp.open && !rsvp.mine);
  // > 0 once opened with 回答を変更 (then it can be cancelled)
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState(false);
  const isEditing = editing && rsvp.open;

  return (
    <Card style={styles.card}>
      <Text variant="subheading" accessibilityRole="header">
        {t("rsvp.title")}
      </Text>
      {!rsvp.open ? (
        <Notice tone="warning">
          {rsvp.closedByOrganizer
            ? t("rsvp.closedByOrganizer")
            : t("rsvp.closed")}
        </Notice>
      ) : rsvp.full ? (
        <Notice tone="warning">{t("rsvp.full")}</Notice>
      ) : null}
      {isEditing ? (
        <RsvpForm
          key={round}
          event={event}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
          }}
          onCancel={round > 0 ? () => setEditing(false) : undefined}
        />
      ) : (
        <View style={styles.view}>
          {saved ? <Notice tone="success">{t("rsvp.saved")}</Notice> : null}
          <Text tone="muted">
            {rsvp.mine
              ? t("rsvp.current", {
                  answer: t(`answer.${rsvp.mine.answer}`),
                  guests: rsvp.mine.guests,
                })
              : t("rsvp.none")}
          </Text>
          {rsvp.open ? (
            <Button
              variant="secondary"
              label={t("rsvp.change")}
              icon={(c) => <Pencil size={16} color={c} aria-hidden />}
              onPress={() => {
                setSaved(false);
                setRound((r) => r + 1);
                setEditing(true);
              }}
              style={styles.start}
            />
          ) : null}
        </View>
      )}
    </Card>
  );
}

function RsvpForm({
  event,
  onSaved,
  onCancel,
}: {
  event: EventDetail;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const errorMessage = useRsvpErrorMessage();
  const { rsvp } = event;
  const [answer, setAnswer] = useState<RsvpAnswer | null>(
    rsvp.mine?.answer ?? null,
  );
  const [guests, setGuests] = useState(rsvp.mine?.guests ?? 0);
  const [error, setError] = useState<string | null>(null);
  const save = useRsvp(event.id);
  const withGuests = answer !== null && answer !== "NOT_GOING";

  const submit = () => {
    if (!answer) {
      setError(t("rsvp.errors.validation"));
      return;
    }
    setError(null);
    save.mutate(
      { answer, guests: withGuests ? guests : 0 },
      {
        onSuccess: () => {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
          onSaved();
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };

  return (
    <View style={styles.form}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t("rsvp.question")}
        style={styles.group}
      >
        <Text variant="small" weight="medium">
          {t("rsvp.question")}
        </Text>
        {ANSWERS.map((a) => (
          <AnswerOption
            key={a}
            label={t(`answer.${a}`)}
            selected={answer === a}
            disabled={save.isPending}
            onPress={() => {
              setAnswer(a);
              setError(null);
            }}
          />
        ))}
      </View>

      {withGuests ? (
        <View style={styles.group}>
          <Text variant="small" weight="medium">
            {t("rsvp.guests")}
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t("rsvp.guests")}
            accessibilityHint={t("rsvp.guestsHint", { max: rsvp.maxGuests })}
            style={styles.chips}
          >
            {Array.from({ length: rsvp.maxGuests + 1 }, (_, n) => (
              <GuestChip
                // biome-ignore lint/suspicious/noArrayIndexKey: the count itself
                key={n}
                count={n}
                selected={guests === n}
                disabled={save.isPending}
                onPress={() => setGuests(n)}
              />
            ))}
          </View>
          <Text variant="small" tone="muted">
            {t("rsvp.guestsHint", { max: rsvp.maxGuests })}
          </Text>
        </View>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <Button
        label={
          save.isPending
            ? t("rsvp.saving")
            : rsvp.mine
              ? t("rsvp.update")
              : t("rsvp.submit")
        }
        loading={save.isPending}
        onPress={submit}
      />
      {onCancel ? (
        <Button
          variant="ghost"
          label={tc("cancel")}
          icon={(c) => <X size={16} color={c} aria-hidden />}
          disabled={save.isPending}
          onPress={onCancel}
          style={styles.start}
        />
      ) : null}
    </View>
  );
}

function AnswerOption({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.optionOn : pressed ? styles.optionPressed : null,
      ]}
    >
      <View style={[styles.dot, selected ? styles.dotOn : null]}>
        {selected ? (
          <Check
            size={14}
            strokeWidth={3}
            color={colors.brand700}
            aria-hidden
          />
        ) : null}
      </View>
      <Text
        variant="small"
        weight="semibold"
        style={{ color: selected ? colors.white : colors.text }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GuestChip({
  count,
  selected,
  disabled,
  onPress,
}: {
  count: number;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={String(count)}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.optionOn : pressed ? styles.optionPressed : null,
      ]}
    >
      <Text
        weight="semibold"
        style={{ color: selected ? colors.white : colors.text }}
      >
        {count}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  view: { gap: space.md },
  start: { alignSelf: "flex-start" },
  form: { gap: space.lg },
  group: { gap: space.sm },
  option: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
  },
  optionOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  optionPressed: { backgroundColor: colors.slate50 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.slate400,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOn: { backgroundColor: colors.white, borderColor: colors.white },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
  },
});
