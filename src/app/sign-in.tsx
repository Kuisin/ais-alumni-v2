import type {
  AppConfig,
  EmailCodeResult,
  Locale,
  SessionResult,
} from "@contract/core";
import { useQuery } from "@tanstack/react-query";
import { isRunningInExpoGo } from "expo";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { Mail, MessageCircle } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  type TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { ApiError, api } from "@/lib/api";
import { signInDevice, useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import { Button, Card, colors, Screen, space, Text, TextField } from "@/ui";

type Step = { step: "email" } | { step: "code"; email: string; notice: string };

const OTP_ERRORS = new Set([
  "invalid_email",
  "invalid_code_format",
  "rate_limited",
  "send_failed",
  "invalid",
  "expired",
  "too_many_attempts",
]);

/**
 * Sign in or create an account (the website's /app page): LINE or Google
 * through the system browser, or a 6-digit code sent by email.
 */
export default function SignInScreen() {
  const t = useTranslations("landing.signIn");
  const tc = useTranslations("common");
  const tm = useTranslations("mobile");
  const { locale, setGuestLocale, signInWithProvider } = useAuth();
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<AppConfig>("/config"),
    staleTime: 5 * 60_000,
  });
  const [busy, setBusy] = useState<null | "line" | "google">(null);
  // Web: /auth sends us back here with ?failed=1 when LINE sign-in failed.
  const { failed } = useLocalSearchParams<{ failed?: string }>();
  const [providerError, setProviderError] = useState(failed === "1");

  const provider = async (p: "line" | "google") => {
    setBusy(p);
    setProviderError(false);
    const result = await signInWithProvider(p).catch(() => "failed" as const);
    setBusy(null);
    if (result === "failed") setProviderError(true);
  };

  const other: Locale = locale === "ja" ? "en" : "ja";
  // Expo Go can only receive exp:// links, which deployed servers never send
  // a sign-in code to (src/server/lib/mobile/oauth.ts): hide LINE / Google
  // there unless the server is a local development one.
  const expoGo =
    isRunningInExpoGo() &&
    !/^http:\/\/(localhost|127\.|192\.168\.|10\.)/.test(API_URL);
  const sso = expoGo ? { line: false, google: false } : config.data?.sso;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Screen contentStyle={styles.content}>
          <View style={styles.langRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tc("switchLanguage")}
              onPress={() => setGuestLocale(other)}
              hitSlop={8}
            >
              <Text variant="small" tone="brand" weight="semibold">
                {other === "en" ? "English" : "日本語"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.brand}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              accessibilityIgnoresInvertColors
            />
            <Text variant="heading" center>
              {tc("appName")}
            </Text>
            <Text variant="small" tone="muted" center>
              {tc("tagline")}
            </Text>
          </View>

          <Card style={styles.card}>
            <View style={styles.gapSm}>
              <Text variant="subheading" accessibilityRole="header">
                {t("title")}
              </Text>
              <Text variant="small" tone="muted">
                {t("subtitle")}
              </Text>
            </View>

            {expoGo && config.data?.sso.line ? (
              <Text variant="small" tone="muted">
                {tm("signIn.expoGoLine")}
              </Text>
            ) : null}

            {sso?.line || sso?.google ? (
              <View style={styles.gapMd}>
                {sso.line ? (
                  <Button
                    variant="line"
                    label={t("line")}
                    loading={busy === "line"}
                    disabled={busy !== null}
                    icon={(c) => <MessageCircle color={c} size={20} />}
                    onPress={() => provider("line")}
                  />
                ) : null}
                {sso.google ? (
                  <Button
                    variant="secondary"
                    label={t("google")}
                    loading={busy === "google"}
                    disabled={busy !== null}
                    onPress={() => provider("google")}
                  />
                ) : null}
                {providerError ? (
                  <Text variant="small" tone="danger" accessibilityRole="alert">
                    {tm("signIn.providerFailed")}
                  </Text>
                ) : null}
                {sso.line ? (
                  <Text variant="caption" tone="subtle">
                    {t("lineNote")}
                  </Text>
                ) : null}
                <View style={styles.or} accessibilityElementsHidden>
                  <View style={styles.rule} />
                  <Text variant="caption" tone="subtle">
                    {t("or")}
                  </Text>
                  <View style={styles.rule} />
                </View>
              </View>
            ) : null}

            <View style={styles.gapMd}>
              <View style={styles.emailTitle}>
                <Mail size={18} color={colors.slate600} />
                <Text variant="small" weight="semibold">
                  {t("emailTitle")}
                </Text>
              </View>
              <EmailCodeForm />
            </View>

            <View style={styles.footer}>
              <Text variant="caption" tone="muted">
                {t.rich("privacy", { link: (chunks) => chunks })}
              </Text>
            </View>
          </Card>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmailCodeForm() {
  const t = useTranslations("auth.otp");
  const { locale, finishSignIn } = useAuth();
  const [state, setState] = useState<Step>({ step: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const codeRef = useRef<TextInput>(null);

  const message = (e: unknown) => {
    const c = e instanceof ApiError ? e.code : "generic";
    return t(`errors.${OTP_ERRORS.has(c) ? c : "generic"}`);
  };

  const send = async (resend: boolean) => {
    setPending(true);
    setError(null);
    try {
      const r = await api<EmailCodeResult>("/auth/email/request", {
        body: { email: email.trim(), locale },
      });
      const address = email.trim().toLowerCase();
      setState({
        step: "code",
        email: address,
        notice:
          r.notice === "rate_limited"
            ? t("errors.rate_limited")
            : resend
              ? t("resent", { email: address })
              : t("sent", { email: address }),
      });
      setCode("");
      setTimeout(() => codeRef.current?.focus(), 100);
    } catch (e) {
      setError(message(e));
    } finally {
      setPending(false);
    }
  };

  const verify = async (email: string, value = code) => {
    setPending(true);
    setError(null);
    try {
      const result = await api<SessionResult>("/auth/email/verify", {
        body: { email, code: value, locale, device: signInDevice() },
      });
      await finishSignIn(result);
    } catch (e) {
      setError(message(e));
      setPending(false);
    }
  };

  if (state.step === "email")
    return (
      <View style={styles.gapMd}>
        <TextField
          label={t("emailLabel")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => email.trim() && send(false)}
          error={error}
        />
        <Button
          label={pending ? t("sending") : t("sendCode")}
          loading={pending}
          disabled={!email.trim()}
          onPress={() => send(false)}
        />
      </View>
    );

  return (
    <View style={styles.gapMd}>
      <Text variant="small" tone="muted" accessibilityLiveRegion="polite">
        {state.notice}
      </Text>
      <TextField
        ref={codeRef}
        label={t("codeLabel")}
        value={code}
        onChangeText={(v) => {
          const next = v.replace(/\D/g, "").slice(0, 6);
          setCode(next);
          // A complete code — typed, pasted or autofilled from the email —
          // signs in (the number pad has no return key).
          if (next.length === 6 && next !== code && !pending)
            void verify(state.email, next);
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        returnKeyType="done"
        onSubmitEditing={() => code.length === 6 && verify(state.email)}
        hint={t("codeHint")}
        error={error}
        style={styles.code}
      />
      <Button
        label={pending ? t("verifying") : t("verify")}
        loading={pending}
        disabled={code.length !== 6}
        onPress={() => verify(state.email)}
      />
      <View style={styles.row}>
        <Button
          variant="ghost"
          compact
          label={t("resend")}
          disabled={pending}
          onPress={() => send(true)}
        />
        <Button
          variant="ghost"
          compact
          label={t("changeEmail")}
          disabled={pending}
          onPress={() => {
            setState({ step: "email" });
            setError(null);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { gap: space.xl, paddingTop: space.md },
  langRow: { flexDirection: "row", justifyContent: "flex-end" },
  brand: { alignItems: "center", gap: space.sm },
  logo: { width: 72, height: 72, borderRadius: 18 },
  card: { gap: space.xl },
  gapSm: { gap: space.xs },
  gapMd: { gap: space.md },
  or: { flexDirection: "row", alignItems: "center", gap: space.md },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.slate300,
  },
  emailTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  code: { fontSize: 24, letterSpacing: 8, textAlign: "center" },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.sm,
  },
  footer: {
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.lg,
  },
});
