import type {
  EmailChangeState,
  MySettings,
  SignInMethodRow,
  StaffArea,
} from "@contract/account";
import { useRouter } from "expo-router";
import {
  Check,
  Download,
  PauseCircle,
  ShieldCheck,
  Trash2,
} from "lucide-react-native";
import { Fragment, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  Badge,
  Button,
  Card,
  colors,
  ListGroup,
  radius,
  Section,
  Separator,
  space,
  Text,
  TextField,
} from "@/ui";
import {
  useChangeEmail,
  useCloseAccount,
  useRemoveSignInMethod,
  useSchoolEmail,
} from "./api";
import { exportMyData } from "./export-data";
import { ErrorLine } from "./settings-sections";

/**
 * 設定's account sections, as on the website's /app/settings: ログイン方法,
 * メールアドレス, 学校のメールアドレス (teachers), データのダウンロード,
 * 管理モード (staff) and 危険な操作 (deactivate / delete).
 */

function Hint({ children }: { children: string }) {
  return (
    <Text variant="small" tone="muted">
      {children}
    </Text>
  );
}

/** A form's result line (the website's FormResult). */
function Result({ ok, text }: { ok: boolean; text?: string | null }) {
  if (!text) return null;
  return (
    <Text
      variant="small"
      tone={ok ? "success" : "danger"}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {text}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// ログイン方法
// ---------------------------------------------------------------------------

export function SignInMethodsSection({ settings }: { settings: MySettings }) {
  const t = useTranslations("settings.methods");
  const tc = useTranslations("common");
  const remove = useRemoveSignInMethod();
  const [confirming, setConfirming] = useState<string | null>(null);
  const rows = settings.signInMethods ?? [];

  const confirm = (method: "google" | "line") =>
    remove.mutate(method, {
      onSuccess: (r) => {
        if (r.ok) setConfirming(null);
      },
    });

  const badge = (row: SignInMethodRow) =>
    row.linked || row.ready ? (
      <Badge
        tone={row.linked ? "green" : "slate"}
        label={row.linked ? t("linked") : t("notLinked")}
      />
    ) : (
      <Badge tone="amber" label={tc("notReady")} />
    );

  return (
    <Section title={t("title")}>
      <Hint>{t("description")}</Hint>
      <ListGroup>
        {rows.map((row, i) => (
          <Fragment key={row.method}>
            {i ? <Separator /> : null}
            <View style={styles.method}>
              <View style={styles.methodHead}>
                <Text weight="medium">{t(row.method)}</Text>
                {badge(row)}
              </View>
              {row.method === "email" && settings.email ? (
                <Hint>{t("emailHint", { email: settings.email })}</Hint>
              ) : null}
              {!row.linked && !row.ready ? (
                <Hint>{t("notReadyHint")}</Hint>
              ) : row.method === "line" && !row.linked ? (
                <Hint>{t("addLineHint")}</Hint>
              ) : row.method === "google" && !row.linked && !row.addable ? (
                <Hint>{t("googleInApp")}</Hint>
              ) : null}

              {row.linked && row.method !== "email" ? (
                confirming === row.method ? (
                  <View style={styles.confirm}>
                    <Text variant="small" weight="medium" style={styles.red}>
                      {t("removeConfirm", { method: t(row.method) })}
                    </Text>
                    {row.method === "line" ? (
                      <Text variant="small" style={styles.red}>
                        {t("removeLineNote")}
                      </Text>
                    ) : null}
                    <View style={styles.buttons}>
                      <Button
                        variant="danger"
                        compact
                        label={
                          remove.isPending ? tc("saving") : t("confirmRemove")
                        }
                        loading={remove.isPending}
                        onPress={() => confirm(row.method as "google" | "line")}
                      />
                      <Button
                        variant="secondary"
                        compact
                        label={tc("cancel")}
                        disabled={remove.isPending}
                        onPress={() => setConfirming(null)}
                      />
                    </View>
                  </View>
                ) : row.removable ? (
                  <Button
                    variant="ghost"
                    compact
                    label={t("remove")}
                    accessibilityLabel={`${t(row.method)}: ${t("remove")}`}
                    onPress={() => {
                      remove.reset();
                      setConfirming(row.method);
                    }}
                    style={styles.start}
                  />
                ) : (
                  <Text variant="caption" tone="subtle">
                    {t("cannotRemoveLast")}
                  </Text>
                )
              ) : null}
            </View>
          </Fragment>
        ))}
      </ListGroup>
      {remove.data ? (
        <Result
          ok={Boolean(remove.data.ok)}
          text={remove.data.message ?? remove.data.error}
        />
      ) : null}
      {remove.isError ? <ErrorLine error={remove.error} /> : null}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// メールアドレス
// ---------------------------------------------------------------------------

export function EmailSection({ settings }: { settings: MySettings }) {
  const t = useTranslations("settings.email");
  const tc = useTranslations("common");
  const change = useChangeEmail();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<EmailChangeState>({ step: "email" });
  const [done, setDone] = useState<string | null>(null);

  const run = (intent: "send" | "resend" | "verify") =>
    change.mutate(
      {
        intent,
        email: intent === "send" ? email.trim() : (state.email ?? ""),
        code: intent === "verify" ? code : undefined,
      },
      {
        onSuccess: (next) => {
          if (next.ok) {
            // Changed: back to the view, with the result under it.
            setDone(next.message ?? null);
            setEditing(false);
            setState({ step: "email" });
            setEmail("");
            setCode("");
            return;
          }
          if (next.step === "code" && state.step !== "code") setCode("");
          if (next.email && next.step === "email") setEmail(next.email);
          setState(next);
        },
      },
    );

  const busy = change.isPending;
  const pending = change.variables?.intent;

  return (
    <Section title={t("title")}>
      <Hint>{t("description")}</Hint>
      <Card style={styles.card}>
        <Text variant="small">
          <Text variant="small" tone="muted">
            {`${t("current")}: `}
          </Text>
          <Text variant="small" weight="medium" selectable>
            {settings.email ?? "—"}
          </Text>
        </Text>
        {!editing ? (
          <>
            <Result ok text={done} />
            <Button
              variant="secondary"
              label={t("change")}
              onPress={() => {
                setDone(null);
                change.reset();
                setEditing(true);
              }}
              style={styles.start}
            />
          </>
        ) : state.step === "code" ? (
          <>
            <Result ok={!state.error} text={state.error ?? state.message} />
            <TextField
              label={t("codeLabel")}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              style={styles.code}
            />
            <View style={styles.buttons}>
              <Button
                label={
                  busy && pending === "verify" ? t("verifying") : t("verify")
                }
                loading={busy && pending === "verify"}
                disabled={busy}
                onPress={() => run("verify")}
              />
              <Button
                variant="secondary"
                label={
                  busy && pending === "resend" ? t("sending") : t("resend")
                }
                disabled={busy}
                onPress={() => run("resend")}
              />
              <Button
                variant="ghost"
                label={t("startOver")}
                disabled={busy}
                onPress={() => {
                  setState({ step: "email" });
                  setCode("");
                }}
              />
            </View>
          </>
        ) : (
          <>
            <TextField
              label={t("newLabel")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              error={state.error}
            />
            <View style={styles.buttons}>
              <Button
                label={busy ? t("sending") : t("sendCode")}
                loading={busy}
                disabled={!email.trim()}
                onPress={() => run("send")}
              />
              <Button
                variant="secondary"
                label={tc("cancel")}
                disabled={busy}
                onPress={() => {
                  setEditing(false);
                  setState({ step: "email" });
                }}
              />
            </View>
          </>
        )}
        {change.isError ? <ErrorLine error={change.error} /> : null}
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 学校のメールアドレス（業務用） — teachers
// ---------------------------------------------------------------------------

export function SchoolEmailSection({
  school,
}: {
  school: NonNullable<MySettings["schoolEmail"]>;
}) {
  const t = useTranslations("settings.schoolEmail");
  const tv = useTranslations("verify");
  const tc = useTranslations("common");
  const { send, verify } = useSchoolEmail();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const email = value.trim().toLowerCase();
  const verifiedEmail = school.verified ? school.email : null;
  const verified = !!email && verifiedEmail === email;
  const busy = send.isPending || verify.isPending;
  const errorText = (e?: string) => tv(`schoolEmail.errors.${e ?? "invalid"}`);

  const onSend = () => {
    setMessage(null);
    send.mutate(email, {
      onSuccess: (r) => {
        if (r.ok) {
          setSentTo(email);
          setMessage({ ok: true, text: tv("schoolEmail.sent", { email }) });
        } else setMessage({ ok: false, text: errorText(r.error) });
      },
    });
  };
  const onConfirm = () => {
    setMessage(null);
    verify.mutate(
      { email, code },
      {
        onSuccess: (r) => {
          if (r.ok) {
            setSentTo(null);
            setCode("");
            setValue("");
            setEditing(false);
            setMessage({ ok: true, text: tv("schoolEmail.verified") });
          } else setMessage({ ok: false, text: errorText(r.error) });
        },
      },
    );
  };

  return (
    <Section title={t("title")}>
      <Hint>{t("description")}</Hint>
      <Card style={styles.card}>
        <View style={styles.methodHead}>
          <Text variant="small" tone="muted">
            {`${t("current")}:`}
          </Text>
          <Text variant="small" weight="medium" selectable>
            {school.email ?? t("none")}
          </Text>
          {school.email && school.verified ? (
            <Badge tone="green" label={tv("schoolEmail.verifiedBadge")} />
          ) : null}
        </View>
        {!editing ? (
          <>
            {message ? <Result ok={message.ok} text={message.text} /> : null}
            <Button
              variant="secondary"
              label={t("change")}
              onPress={() => {
                setMessage(null);
                setEditing(true);
              }}
              style={styles.start}
            />
          </>
        ) : (
          <>
            <TextField
              label={tv("fields.schoolEmail")}
              hint={tv("hints.schoolEmail")}
              placeholder="name@aisnagoya.net"
              value={value}
              onChangeText={setValue}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
            {verified ? (
              <Badge tone="green" label={tv("schoolEmail.verifiedBadge")} />
            ) : (
              <Button
                variant="secondary"
                label={
                  sentTo === email
                    ? tv("schoolEmail.resend")
                    : tv("schoolEmail.send")
                }
                loading={send.isPending}
                disabled={busy || !email}
                onPress={onSend}
                style={styles.start}
              />
            )}
            {sentTo && sentTo === email && !verified ? (
              <>
                <TextField
                  label={tv("schoolEmail.codeLabel")}
                  value={code}
                  onChangeText={(v) =>
                    setCode(v.replace(/\D/g, "").slice(0, 6))
                  }
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  style={styles.code}
                />
                <Button
                  label={tv("schoolEmail.confirm")}
                  loading={verify.isPending}
                  disabled={busy || code.length !== 6}
                  onPress={onConfirm}
                  style={styles.start}
                />
              </>
            ) : null}
            {message ? <Result ok={message.ok} text={message.text} /> : null}
            <Button
              variant="ghost"
              label={tc("cancel")}
              disabled={busy}
              onPress={() => {
                setEditing(false);
                setMessage(null);
              }}
              style={styles.start}
            />
          </>
        )}
        {send.isError ? <ErrorLine error={send.error} /> : null}
        {verify.isError ? <ErrorLine error={verify.error} /> : null}
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// データのダウンロード
// ---------------------------------------------------------------------------

export function ExportSection() {
  const t = useTranslations("settings.export");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportMyData(t("title"));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title={t("title")}>
      <Hint>{t("description")}</Hint>
      <Button
        variant="secondary"
        label={t("download")}
        icon={(c) => <Download color={c} size={18} aria-hidden />}
        loading={busy}
        onPress={() => void run()}
        style={styles.start}
      />
      {error ? <ErrorLine error={error} /> : null}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 管理モード
// ---------------------------------------------------------------------------

export function AdminModeSection({ areas }: { areas: StaffArea[] }) {
  const t = useTranslations("settings.adminMode");
  const router = useRouter();
  return (
    <Section title={t("title")}>
      <Hint>{t("description")}</Hint>
      <Card style={styles.card}>
        <View style={styles.gapXs}>
          <Text variant="small" weight="medium">
            {t("roles")}
          </Text>
          {areas.map((k) => (
            <View key={k} style={styles.check}>
              <Check color={colors.green600} size={16} aria-hidden />
              <Text variant="small" style={styles.flex}>
                {t(`access.${k}`)}
              </Text>
            </View>
          ))}
        </View>
        <Button
          label={t("button")}
          icon={(c) => <ShieldCheck color={c} size={18} aria-hidden />}
          onPress={() => router.push("/admin")}
        />
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 危険な操作
// ---------------------------------------------------------------------------

/**
 * Deactivating and deleting the account, each confirmed as on the website
 * (deletion by typing the confirmation word). In the app itself, as App
 * Store guideline 5.1.1(v) requires.
 */
export function DangerSection() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { deactivate, remove } = useCloseAccount();
  const [open, setOpen] = useState<null | "deactivate" | "delete">(null);
  const [word, setWord] = useState("");

  return (
    <Section title={t("danger.title")}>
      <Hint>{t("danger.description")}</Hint>
      <Card style={styles.danger}>
        <View style={styles.gapSm}>
          <View style={styles.check}>
            <PauseCircle color={colors.slate600} size={20} aria-hidden />
            <Text weight="semibold" accessibilityRole="header">
              {t("deactivate.title")}
            </Text>
          </View>
          <Hint>{t("deactivate.description")}</Hint>
          {open === "deactivate" ? (
            <View style={styles.confirm}>
              <Text variant="small" style={styles.red}>
                {t("deactivate.confirmText")}
              </Text>
              <Result ok={false} text={deactivate.data?.error} />
              {deactivate.isError ? (
                <ErrorLine error={deactivate.error} />
              ) : null}
              <View style={styles.buttons}>
                <Button
                  variant="danger"
                  label={
                    deactivate.isPending
                      ? t("deactivate.working")
                      : t("deactivate.confirmButton")
                  }
                  loading={deactivate.isPending}
                  onPress={() => deactivate.mutate()}
                />
                <Button
                  variant="secondary"
                  label={tc("cancel")}
                  disabled={deactivate.isPending}
                  onPress={() => setOpen(null)}
                />
              </View>
            </View>
          ) : (
            <Button
              variant="secondary"
              label={t("deactivate.button")}
              onPress={() => {
                deactivate.reset();
                setOpen("deactivate");
              }}
              style={styles.start}
            />
          )}
        </View>

        <View style={[styles.gapSm, styles.divider]}>
          <View style={styles.check}>
            <Trash2 color={colors.red700} size={20} aria-hidden />
            <Text
              weight="semibold"
              accessibilityRole="header"
              style={styles.red}
            >
              {t("delete.title")}
            </Text>
          </View>
          <Hint>{t("delete.description")}</Hint>
          {open === "delete" ? (
            <View style={styles.confirm}>
              <TextField
                label={t("delete.typeToConfirm", {
                  word: t("delete.confirmWord"),
                })}
                value={word}
                onChangeText={setWord}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                error={remove.data?.error}
              />
              {remove.isError ? <ErrorLine error={remove.error} /> : null}
              <View style={styles.buttons}>
                <Button
                  variant="danger"
                  label={
                    remove.isPending
                      ? t("delete.working")
                      : t("delete.confirmButton")
                  }
                  loading={remove.isPending}
                  onPress={() => remove.mutate(word)}
                />
                <Button
                  variant="secondary"
                  label={tc("cancel")}
                  disabled={remove.isPending}
                  onPress={() => {
                    setOpen(null);
                    setWord("");
                  }}
                />
              </View>
            </View>
          ) : (
            <Button
              variant="danger"
              label={t("delete.button")}
              onPress={() => {
                remove.reset();
                setOpen("delete");
              }}
              style={styles.start}
            />
          )}
        </View>
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  danger: {
    gap: space.lg,
    borderColor: colors.red100,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.red100,
    paddingTop: space.lg,
  },
  method: { gap: space.xs, padding: space.md },
  methodHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  confirm: {
    gap: space.sm,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: space.md,
  },
  red: { color: colors.red700 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  start: { alignSelf: "flex-start" },
  code: { maxWidth: 160, letterSpacing: 4 },
  gapXs: { gap: space.xs },
  gapSm: { gap: space.sm },
  check: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
});
