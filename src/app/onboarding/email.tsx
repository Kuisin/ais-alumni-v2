import type { EmailCodeSent, OtpError } from "@contract/onboarding";
import { useRef, useState } from "react";
import { StyleSheet, type TextInput, View } from "react-native";
import { useTranslations } from "use-intl";
import { OnboardingShell } from "@/features/onboarding/shell";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, space, Text, TextField } from "@/ui";

const OTP_ERRORS = new Set<OtpError>([
  "invalid_email",
  "invalid_code_format",
  "rate_limited",
  "send_failed",
  "invalid",
  "expired",
  "too_many_attempts",
]);

type Step = { step: "email" } | { step: "code"; email: string; notice: string };

/**
 * Mandatory email confirmation for LINE-first accounts (the website's
 * /app/onboarding/email): a 6-digit code to the address. An address that
 * already has an account takes this LINE sign-in over (merged).
 */
export default function OnboardingEmailScreen() {
  const t = useTranslations("onboarding.email");
  const to = useTranslations("auth.otp");
  const { refreshMe } = useAuth();
  const [state, setState] = useState<Step>({ step: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const codeRef = useRef<TextInput>(null);

  const message = (e: unknown) => {
    const c = e instanceof ApiError ? e.code : "generic";
    return to(`errors.${OTP_ERRORS.has(c as OtpError) ? c : "generic"}`);
  };

  const send = async (resend: boolean) => {
    setPending(true);
    setError(null);
    try {
      const r = await api<EmailCodeSent>("/onboarding/email/request", {
        body: { email: email.trim(), resend },
      });
      setState({
        step: "code",
        email: r.email,
        notice:
          r.notice === "rate_limited"
            ? to("errors.rate_limited")
            : to(r.notice, { email: r.email }),
      });
      setCode("");
      setTimeout(() => codeRef.current?.focus(), 100);
    } catch (e) {
      setError(message(e));
    } finally {
      setPending(false);
    }
  };

  const verify = async (address: string, value = code) => {
    setPending(true);
    setError(null);
    try {
      await api("/onboarding/email/verify", {
        body: { email: address, code: value },
      });
      // /me moves the account on (the LINE step, or where a merged account is).
      await refreshMe();
    } catch (e) {
      setError(message(e));
      setPending(false);
    }
  };

  return (
    <OnboardingShell title={t("title")} description={t("description")}>
      <Card style={styles.card}>
        {state.step === "email" ? (
          <View style={styles.gap}>
            <TextField
              label={to("emailLabel")}
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
              label={pending ? to("sending") : to("sendCode")}
              loading={pending}
              disabled={!email.trim()}
              onPress={() => send(false)}
            />
          </View>
        ) : (
          <View style={styles.gap}>
            <Text variant="small" tone="muted" accessibilityLiveRegion="polite">
              {state.notice}
            </Text>
            <TextField
              ref={codeRef}
              label={to("codeLabel")}
              value={code}
              onChangeText={(v) => {
                const next = v.replace(/\D/g, "").slice(0, 6);
                setCode(next);
                if (next.length === 6 && next !== code && !pending)
                  void verify(state.email, next);
              }}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              onSubmitEditing={() => code.length === 6 && verify(state.email)}
              hint={to("codeHint")}
              error={error}
              style={styles.code}
            />
            <Button
              label={pending ? to("verifying") : t("verify")}
              loading={pending}
              disabled={code.length !== 6}
              onPress={() => verify(state.email)}
            />
            <View style={styles.row}>
              <Button
                variant="ghost"
                compact
                label={to("resend")}
                disabled={pending}
                onPress={() => void send(true)}
              />
              <Button
                variant="ghost"
                compact
                label={to("changeEmail")}
                disabled={pending}
                onPress={() => {
                  setState({ step: "email" });
                  setError(null);
                }}
              />
            </View>
          </View>
        )}
        <Text variant="small" tone="muted">
          {t("existingAccountNote")}
        </Text>
      </Card>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
  gap: { gap: space.md },
  code: { fontSize: 24, letterSpacing: 8, textAlign: "center" },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.sm,
  },
});
