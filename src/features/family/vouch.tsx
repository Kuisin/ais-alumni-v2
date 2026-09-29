import type { VouchAnswer, VouchPage } from "@contract/family";
import { X } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button, Card, space, Text } from "@/ui";
import { errorCode, useAnswerVouch } from "./api";
import { Notice } from "./parts";

const ANSWERS: { value: VouchAnswer; variant: "primary" | "secondary" }[] = [
  { value: "YES", variant: "primary" },
  { value: "NO", variant: "secondary" },
  { value: "NOT_SURE", variant: "secondary" },
];
const ERRORS = ["forbidden", "validation", "closed"] as const;

/** The applicant and the answer buttons (the website's VouchAnswerForm). */
export function VouchCard({ id, vouch }: { id: string; vouch: VouchPage }) {
  const t = useTranslations("vouch");
  const tc = useTranslations("common");
  const answer = useAnswerVouch(id);
  // View first once answered; the answer changes only via the button.
  const [editing, setEditing] = useState(!vouch.answer);
  const [pending, setPending] = useState<VouchAnswer | null>(null);

  const choose = (value: VouchAnswer) => {
    setPending(value);
    answer.mutate(value, { onSuccess: () => setEditing(false) });
  };

  return (
    <Card style={styles.card}>
      <View>
        <Text variant="heading">{vouch.name}</Text>
        {vouch.otherName ? <Text tone="muted">{vouch.otherName}</Text> : null}
        {vouch.nameAtAis ? (
          <Text variant="small" tone="muted">
            {t("nameAtAis", { name: vouch.nameAtAis })}
          </Text>
        ) : null}
        {vouch.years ? (
          <Text variant="small" tone="muted">
            {t("years", { years: vouch.years })}
          </Text>
        ) : null}
      </View>
      <Text weight="semibold">{t("question")}</Text>
      {vouch.answer ? (
        <Text variant="small">
          {t("currentAnswer", { answer: t(`answers.${vouch.answer}`) })}
        </Text>
      ) : null}
      {vouch.closed ? (
        <Notice tone="info">{t("closed")}</Notice>
      ) : !editing ? (
        <Button
          variant="secondary"
          label={t("change")}
          onPress={() => {
            answer.reset();
            setEditing(true);
          }}
          style={styles.start}
        />
      ) : (
        <View style={styles.answers} accessibilityLabel={t("question")}>
          {ANSWERS.map((a) => (
            <Button
              key={a.value}
              variant={a.variant}
              label={t(`answers.${a.value}`)}
              loading={answer.isPending && pending === a.value}
              disabled={answer.isPending}
              onPress={() => choose(a.value)}
            />
          ))}
          {vouch.answer ? (
            <Button
              variant="ghost"
              label={tc("cancel")}
              icon={(c) => <X size={18} color={c} aria-hidden />}
              onPress={() => setEditing(false)}
              style={styles.start}
            />
          ) : null}
        </View>
      )}
      {answer.isSuccess ? (
        <Notice tone="success">{t("messages.saved")}</Notice>
      ) : answer.isError ? (
        <Notice tone="error">
          {t(`messages.${errorCode(answer.error, ERRORS, "forbidden")}`)}
        </Notice>
      ) : null}
      <Text variant="caption" tone="subtle">
        {t("privacy")}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
  answers: { gap: space.sm },
  start: { alignSelf: "flex-start" },
});
