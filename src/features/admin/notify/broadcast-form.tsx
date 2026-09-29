import type {
  AdminNotifyPage,
  BroadcastAudienceKey,
  BroadcastResult,
} from "@contract/admin-notify";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Notice } from "@/features/news/parts";
import { ChoiceList, SelectField } from "@/features/people/choices";
import { Sheet } from "@/features/people/sheet";
import { ApiError } from "@/lib/api";
import { Button, colors, radius, space, Text, TextField, TOUCH } from "@/ui";
import { useBroadcast } from "./api";

type AudienceKind = "ALL" | "ROLES" | "COHORT";

const TITLE_MAX = 100;
const BODY_MAX = 2000;

/**
 * Compose → confirm (recipient and LINE / email counts) → sent (the
 * website's BroadcastForm). Values stay while confirming; the server checks
 * the right and the limits on both steps.
 */
export function BroadcastForm({
  page,
}: {
  page: Pick<AdminNotifyPage, "canAny" | "cohorts" | "audienceKeys">;
}) {
  const t = useTranslations("broadcast");
  const tr = useTranslations("roles");
  const tm = useTranslations("mobile.errors");
  const { canAny, cohorts } = page;
  const send = useBroadcast();
  const [state, setState] = useState<BroadcastResult | null>(null);
  const [audience, setAudience] = useState<AudienceKind>(
    canAny ? "ALL" : "COHORT",
  );
  const [roles, setRoles] = useState<BroadcastAudienceKey[]>([]);
  const [cohortId, setCohortId] = useState(
    canAny ? "" : (cohorts[0]?.id ?? ""),
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [picking, setPicking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const step = state?.step ?? "compose";
  const locked = step !== "compose";
  const err = (f: "title" | "body" | "audience" | "cohortId") => {
    const code = state?.fieldErrors?.[f];
    return code ? t(`fieldErrors.${code}`) : null;
  };

  const submit = (intent: "preview" | "send") => {
    setFailed(null);
    send.mutate(
      { intent, audience, roles, cohortId, title, body },
      {
        onSuccess: setState,
        onError: (e) =>
          setFailed(
            e instanceof ApiError && e.status === 0
              ? tm("network")
              : e instanceof ApiError && e.status === 403
                ? t("errors.forbidden")
                : tm("generic"),
          ),
      },
    );
  };

  if (step === "sent" && state?.preview) {
    return (
      <View style={styles.form}>
        <Notice tone="success">{t("sentSummary", state.preview)}</Notice>
        <Button
          variant="secondary"
          label={t("sendAnother")}
          onPress={() => {
            setTitle("");
            setBody("");
            setRoles([]);
            setState(null);
          }}
        />
      </View>
    );
  }

  const cohortLabel =
    cohorts.find((c) => c.id === cohortId)?.label ?? t("audience.chooseCohort");
  const cohortChoices = [
    ...(canAny ? [{ value: "", label: t("audience.chooseCohort") }] : []),
    ...cohorts.map((c) => ({ value: c.id, label: c.label })),
  ];

  return (
    <View style={styles.form}>
      <View style={styles.group}>
        <Text variant="small" weight="semibold">
          {t("audience.label")}
        </Text>
        {canAny ? (
          <View accessibilityRole="radiogroup" style={styles.group}>
            {(["ALL", "ROLES", "COHORT"] as const).map((k) => {
              const on = audience === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: locked }}
                  accessibilityHint={t(`audience.desc.${k}`)}
                  disabled={locked}
                  onPress={() => setAudience(k)}
                  style={({ pressed }) => [
                    styles.choice,
                    on ? styles.choiceOn : null,
                    pressed && !on ? styles.pressed : null,
                    locked ? styles.locked : null,
                  ]}
                >
                  <View style={[styles.radio, on ? styles.radioOn : null]}>
                    {on ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text weight="medium">{t(`audience.${k}`)}</Text>
                    <Text variant="caption" tone="muted">
                      {t(`audience.desc.${k}`)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text variant="small" tone="muted">
            {t("audience.leaderOnly")}
          </Text>
        )}
        {audience === "ROLES" ? (
          <View style={styles.roles}>
            {page.audienceKeys.map((r) => {
              const on = roles.includes(r);
              return (
                <Pressable
                  key={r}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: locked }}
                  disabled={locked}
                  onPress={() =>
                    setRoles((prev) =>
                      on ? prev.filter((x) => x !== r) : [...prev, r],
                    )
                  }
                  style={[styles.check, locked ? styles.locked : null]}
                >
                  <View style={[styles.box, on ? styles.boxOn : null]}>
                    {on ? (
                      <Check size={14} color={colors.white} aria-hidden />
                    ) : null}
                  </View>
                  <Text variant="small">{tr(`audience.${r}`)}</Text>
                </Pressable>
              );
            })}
            {err("audience") ? (
              <Text variant="small" tone="danger">
                {err("audience")}
              </Text>
            ) : null}
          </View>
        ) : null}
        {audience === "COHORT" ? (
          <View style={styles.group}>
            <SelectField
              label={t("audience.cohort")}
              value={cohortLabel}
              onPress={() => {
                if (!locked) setPicking(true);
              }}
            />
            {err("cohortId") ? (
              <Text variant="small" tone="danger">
                {err("cohortId")}
              </Text>
            ) : (
              <Text variant="caption" tone="subtle">
                {t("audience.cohortHint")}
              </Text>
            )}
            <Sheet
              visible={picking}
              onClose={() => setPicking(false)}
              title={t("audience.cohort")}
            >
              <ChoiceList
                label={t("audience.cohort")}
                choices={cohortChoices}
                value={cohortId}
                onChange={(v) => {
                  setCohortId(v);
                  setPicking(false);
                }}
              />
            </Sheet>
          </View>
        ) : null}
      </View>

      <View style={styles.group}>
        <TextField
          label={`${t("title")} *`}
          value={title}
          onChangeText={setTitle}
          maxLength={TITLE_MAX}
          editable={!locked}
          error={err("title")}
        />
        <Text variant="caption" tone="subtle" style={styles.count}>
          {t("charCount", { count: title.length, max: TITLE_MAX })}
        </Text>
      </View>
      <View style={styles.group}>
        <TextField
          label={`${t("body")} *`}
          value={body}
          onChangeText={setBody}
          maxLength={BODY_MAX}
          editable={!locked}
          multiline
          textAlignVertical="top"
          style={styles.body}
          hint={t("bodyHint")}
          error={err("body")}
        />
        <Text variant="caption" tone="subtle" style={styles.count}>
          {t("charCount", { count: body.length, max: BODY_MAX })}
        </Text>
      </View>

      {state?.message && step === "compose" ? (
        <Notice tone="error">{t(state.message)}</Notice>
      ) : null}
      {failed ? <Notice tone="error">{failed}</Notice> : null}
      {step === "confirm" && state?.preview ? (
        <Notice tone="warning">{t("confirmSummary", state.preview)}</Notice>
      ) : null}

      {step === "confirm" ? (
        <View style={styles.buttons}>
          <Button
            label={
              send.isPending
                ? t("sending")
                : t("send", { count: state?.preview?.recipients ?? 0 })
            }
            loading={send.isPending}
            onPress={() => submit("send")}
          />
          <Button
            variant="secondary"
            label={t("edit")}
            disabled={send.isPending}
            onPress={() => setState({ step: "compose" })}
          />
        </View>
      ) : (
        <Button
          label={send.isPending ? t("checking") : t("preview")}
          loading={send.isPending}
          onPress={() => submit("preview")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  group: { gap: space.sm },
  flex: { flex: 1, gap: 2 },
  choice: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  choiceOn: { borderColor: colors.brand700, backgroundColor: colors.brand50 },
  pressed: { backgroundColor: colors.slate50 },
  locked: { opacity: 0.6 },
  radio: {
    marginTop: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.slate400,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.brand700 },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.brand700,
  },
  roles: { paddingLeft: space.lg },
  check: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.slate400,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { borderColor: colors.brand700, backgroundColor: colors.brand700 },
  body: { minHeight: 140 },
  count: { textAlign: "right" },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
