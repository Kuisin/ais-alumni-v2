import type {
  SupportDefaults,
  SupportFieldErrors,
  SupportSent,
} from "@contract/onboarding";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { FormText, Notice, Select } from "@/features/onboarding/controls";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  SUPPORT_LIMITS,
  SUPPORT_TYPE_KEYS,
  SUPPORT_TYPES,
  type SupportType,
} from "@/server/lib/support";
import { Button, colors, space, Text } from "@/ui";

/**
 * お問い合わせ form (the website's SupportForm): 種類 → 内容, 件名, 本文,
 * and name / email (filled in for members). Values stay when there are
 * errors; the server checks everything again.
 */
export function SupportForm({
  type: initialType,
  topic: initialTopic,
}: {
  type?: string;
  topic?: string;
}) {
  const t = useTranslations("support");
  const router = useRouter();
  const { status, me, token } = useAuth();
  const defaults = useQuery({
    queryKey: ["support", "defaults", token],
    queryFn: () => api<SupportDefaults>("/support"),
    enabled: Boolean(token),
  });
  const startType = (
    initialType && initialType in SUPPORT_TYPES ? initialType : ""
  ) as SupportType | "";
  const [type, setType] = useState<SupportType | "">(startType);
  const [topic, setTopic] = useState(
    startType &&
      (SUPPORT_TYPES[startType] as readonly string[]).includes(
        initialTopic ?? "",
      )
      ? (initialTopic as string)
      : "",
  );
  const [values, setValues] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  // Members: their name and address, once loaded (not over what they typed).
  useEffect(() => {
    const d = defaults.data;
    if (!d) return;
    setValues((v) => ({
      ...v,
      name: v.name || d.name,
      email: v.email || d.email,
    }));
  }, [defaults.data]);
  const [fieldErrors, setFieldErrors] = useState<SupportFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const set = (k: keyof typeof values) => (v: string) =>
    setValues((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const r = await api<SupportSent>("/support", {
        body: { ...values, type, topic },
      });
      setSent(r.ref);
    } catch (e) {
      const body = e instanceof ApiError ? e.body : null;
      setFieldErrors((body?.fieldErrors as SupportFieldErrors) ?? {});
      setError(
        typeof body?.message === "string" ? body.message : t("errors.check"),
      );
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    const member = status === "signedIn" && me?.user.state === "ACTIVE";
    return (
      <View style={styles.sent} accessibilityLiveRegion="polite">
        <CircleCheck size={48} color={colors.green600} aria-hidden />
        <Text variant="subheading" center accessibilityRole="header">
          {t("sent.title")}
        </Text>
        <Text center>{t("sent.body")}</Text>
        <Text variant="small" tone="muted" center>
          {`${t("sent.ref")} `}
          <Text variant="small" weight="semibold">
            {sent}
          </Text>
        </Text>
        <Button
          variant="ghost"
          label={member ? t("sent.backApp") : t("sent.close")}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Select
        label={t("form.type")}
        error={fieldErrors.type}
        value={type}
        onChange={(v) => {
          setType(v as SupportType | "");
          setTopic("");
        }}
        placeholder={t("form.choose")}
        options={SUPPORT_TYPE_KEYS.map((k) => ({
          value: k,
          label: t(`types.${k}.label`),
        }))}
      />
      <Select
        label={t("form.topic")}
        error={fieldErrors.topic}
        hint={type ? t(`types.${type}.hint`) : t("form.topicFirst")}
        value={topic}
        disabled={!type}
        onChange={setTopic}
        placeholder={t("form.choose")}
        options={
          type
            ? SUPPORT_TYPES[type].map((k) => ({
                value: k,
                label: t(`types.${type}.topics.${k}`),
              }))
            : []
        }
      />
      <FormText
        label={t("form.subject")}
        value={values.subject}
        onChangeText={set("subject")}
        maxLength={SUPPORT_LIMITS.subject}
        placeholder={t("form.subjectPlaceholder")}
        error={fieldErrors.subject}
      />
      <FormText
        label={t("form.message")}
        value={values.message}
        onChangeText={set("message")}
        maxLength={SUPPORT_LIMITS.message}
        multiline
        numberOfLines={7}
        textAlignVertical="top"
        style={styles.message}
        hint={t(`form.messageHint.${type || "default"}`)}
        error={fieldErrors.message}
      />
      <FormText
        label={t("form.name")}
        autoComplete="name"
        textContentType="name"
        value={values.name}
        onChangeText={set("name")}
        maxLength={SUPPORT_LIMITS.name}
        error={fieldErrors.name}
      />
      <FormText
        label={t("form.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        value={values.email}
        onChangeText={set("email")}
        maxLength={SUPPORT_LIMITS.email}
        hint={t("form.emailHint")}
        error={fieldErrors.email}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Text variant="caption" tone="subtle">
        {t("form.privacy")}
      </Text>
      <Button
        label={pending ? t("form.sending") : t("form.send")}
        loading={pending}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  message: { minHeight: 160, paddingTop: space.sm },
  sent: { alignItems: "center", gap: space.md, paddingVertical: space.lg },
});
