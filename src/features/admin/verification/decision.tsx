import type {
  VerificationActionResult,
  VerificationDecision,
  VerificationDetail,
} from "@contract/admin";
import { useRouter } from "expo-router";
import {
  Check,
  ChevronRight,
  Gavel,
  type LucideIcon,
  MessageSquareMore,
  X,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button, colors, radius, space, Text, TextField } from "@/ui";
import { useDecideVerification } from "./api";
import { DetailCard } from "./parts";

const DECISIONS: VerificationDecision[] = ["APPROVE", "NEEDS_INFO", "REJECT"];

const ICON: Record<VerificationDecision, LucideIcon> = {
  APPROVE: Check,
  NEEDS_INFO: MessageSquareMore,
  REJECT: X,
};

const TONE: Record<
  VerificationDecision,
  { border: string; bg: string; fg: string }
> = {
  APPROVE: { border: colors.green600, bg: colors.green50, fg: colors.green700 },
  NEEDS_INFO: {
    border: colors.amber400,
    bg: colors.amber50,
    fg: colors.amber900,
  },
  REJECT: { border: colors.red600, bg: colors.red50, fg: colors.red700 },
};

/**
 * 判断 (the website's DecisionForm): approve, ask for more information
 * (message required) or reject (reason required); the note is sent to the
 * applicant. Decided: on to the next application or back to the queue.
 */
export function DecisionCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify");
  const router = useRouter();
  return (
    <DetailCard title={t("decision.title")} icon={Gavel}>
      {d.open ? (
        <DecisionForm requestId={d.id} />
      ) : (
        <>
          <Text variant="small" tone="muted">
            {t("decision.closed")}
          </Text>
          {d.nextId ? (
            <Button
              label={t("decision.next")}
              icon={(c) => <ChevronRight size={16} color={c} aria-hidden />}
              onPress={() =>
                router.replace({
                  pathname: "/admin/verification/[id]",
                  params: { id: d.nextId as string },
                })
              }
            />
          ) : null}
          <Button
            label={t("decision.backToQueue")}
            variant={d.nextId ? "secondary" : "primary"}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/admin/verification")
            }
          />
        </>
      )}
    </DetailCard>
  );
}

function DecisionForm({ requestId }: { requestId: string }) {
  const t = useTranslations("adminVerify");
  const decide = useDecideVerification(requestId);
  const [decision, setDecision] = useState<VerificationDecision>("APPROVE");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<VerificationActionResult | null>(null);
  const noteError = result?.errors?.note
    ? t(`errors.${result.errors.note}`)
    : null;

  const submit = () => {
    setResult(null);
    decide.mutate(
      { decision, note },
      {
        onSuccess: setResult,
        onError: () => setResult({ ok: false, message: "generic" }),
      },
    );
  };

  return (
    <View style={styles.form}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t("decision.label")}
        style={styles.options}
      >
        {DECISIONS.map((key) => {
          const on = decision === key;
          const Icon = ICON[key];
          const tone = TONE[key];
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setDecision(key)}
              style={({ pressed }) => [
                styles.option,
                on
                  ? { borderColor: tone.border, backgroundColor: tone.bg }
                  : pressed
                    ? styles.optionPressed
                    : null,
              ]}
            >
              <View
                style={[styles.radio, on ? { borderColor: tone.border } : null]}
              >
                {on ? (
                  <View
                    style={[styles.radioDot, { backgroundColor: tone.border }]}
                  />
                ) : null}
              </View>
              <Icon
                size={16}
                color={on ? tone.fg : colors.slate700}
                aria-hidden
              />
              <Text style={{ color: on ? tone.fg : colors.text }}>
                {t(`decision.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label={`${
          decision === "REJECT"
            ? t("decision.reason")
            : decision === "NEEDS_INFO"
              ? t("decision.message")
              : t("decision.noteOptional")
        }${decision !== "APPROVE" ? " *" : ""}`}
        hint={t("decision.noteHint")}
        error={noteError}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={2000}
        textAlignVertical="top"
        style={styles.note}
      />
      <Button
        label={
          decide.isPending ? t("saving") : t(`decision.submit.${decision}`)
        }
        variant={decision === "REJECT" ? "danger" : "primary"}
        loading={decide.isPending}
        onPress={submit}
      />
      <View accessibilityLiveRegion="polite">
        {result?.message ? (
          <View
            style={[
              styles.alert,
              result.ok ? styles.alertOk : styles.alertError,
            ]}
          >
            <Text variant="small" tone={result.ok ? "success" : "danger"}>
              {t(`messages.${result.message}`)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  options: { gap: space.sm },
  option: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  optionPressed: { backgroundColor: colors.slate50 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.slate400,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  note: { minHeight: 110, paddingTop: space.sm },
  alert: { borderRadius: radius.md, padding: space.md },
  alertOk: { backgroundColor: colors.green50 },
  alertError: { backgroundColor: colors.red50 },
});
