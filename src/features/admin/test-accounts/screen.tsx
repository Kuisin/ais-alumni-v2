import type { TestAccount, TestAccountType } from "@contract/admin-members";
import type { Locale } from "@contract/core";
import { Stack, useRouter } from "expo-router";
import { FlaskConical, Trash2, UserPlus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { confirmAction } from "@/features/me/confirm";
import { isApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  Badge,
  Button,
  colors,
  EmptyState,
  ListGroup,
  QueryState,
  radius,
  Screen,
  Separator,
  space,
  Text,
  TextField,
} from "@/ui";
import { Notice } from "../parts";
import {
  useCreateTestAccount,
  useDeleteTestAccount,
  useTestAccounts,
} from "./api";

const TYPES: TestAccountType[] = [
  "PARENT",
  "CURRENT_STUDENT",
  "GRADUATE",
  "CURRENT_TEACHER",
  "FORMER_TEACHER",
];

/**
 * テストアカウント (管理モード, admins only; app only): make ACTIVE member
 * accounts without an application, to try the app as each member type.
 * They're hidden from real members' lists, statistics and bulk sends
 * (src/server/lib/test-hidden.ts).
 */
export function TestAccountsScreen() {
  const t = useTranslations("mobile.testAccounts");
  const query = useTestAccounts();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Text variant="small" tone="muted">
          {t("description")}
        </Text>
        <CreateForm />
        <Heading
          icon={FlaskConical}
          title={t("list.title")}
          count={query.data?.accounts.length}
        />
        <QueryState query={query}>
          {(data) =>
            data.accounts.length ? (
              <ListGroup>
                {data.accounts.map((a, i) => (
                  <View key={a.id}>
                    {i > 0 ? <Separator /> : null}
                    <AccountRow a={a} />
                  </View>
                ))}
              </ListGroup>
            ) : (
              <EmptyState title={t("list.none")} />
            )
          }
        </QueryState>
      </Screen>
    </>
  );
}

function CreateForm() {
  const t = useTranslations("mobile.testAccounts");
  const create = useCreateTestAccount();
  const [type, setType] = useState<TestAccountType>("PARENT");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<
    { ok: true; email: string } | { ok: false; error: string } | null
  >(null);
  const ready = email.trim().includes("@") && name.trim().length > 0;
  const submit = () => {
    setResult(null);
    create.mutate(
      { type, email: email.trim(), name: name.trim() },
      {
        onSuccess: (a) => {
          setResult({ ok: true, email: a.email ?? email.trim() });
          setEmail("");
          setName("");
        },
        onError: (e) =>
          setResult({
            ok: false,
            error: isApiError(e, "email_taken")
              ? t("errors.emailTaken")
              : isApiError(e, "invalid")
                ? t("errors.invalid")
                : "",
          }),
      },
    );
  };
  return (
    <View style={styles.form}>
      <Heading icon={UserPlus} title={t("create.title")} />
      <Text variant="small" weight="semibold">
        {t("create.type")}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {TYPES.map((key) => {
          const on = key === type;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setType(key)}
              style={({ pressed }) => [
                styles.chip,
                on ? styles.chipOn : pressed ? styles.chipPressed : null,
              ]}
            >
              <Text
                variant="small"
                weight="semibold"
                style={{ color: on ? colors.white : colors.slate700 }}
              >
                {t(`types.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label={t("create.email")}
        hint={t("create.emailHint")}
        value={email}
        onChangeText={setEmail}
        placeholder="name+parent@gmail.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        maxLength={254}
      />
      <TextField
        label={t("create.name")}
        hint={t("create.nameHint")}
        value={name}
        onChangeText={setName}
        placeholder="Test, Parent"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={100}
      />
      {result ? (
        <Notice tone={result.ok ? "success" : "error"}>
          {result.ok ? (
            <Text variant="small">
              {t("create.done", { email: result.email })}
            </Text>
          ) : (
            <ErrorText text={result.error} />
          )}
        </Notice>
      ) : null}
      <Button
        label={t("create.submit")}
        icon={(c) => <UserPlus color={c} size={16} aria-hidden />}
        loading={create.isPending}
        disabled={!ready}
        onPress={submit}
      />
    </View>
  );
}

function ErrorText({ text }: { text: string }) {
  const te = useTranslations("mobile.errors");
  return (
    <Text variant="small" tone="danger">
      {text || te("generic")}
    </Text>
  );
}

function AccountRow({ a }: { a: TestAccount }) {
  const t = useTranslations("mobile.testAccounts");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const remove = useDeleteTestAccount();
  const [failed, setFailed] = useState(false);
  const onDelete = async () => {
    const ok = await confirmAction({
      title: t("list.deleteConfirm"),
      message: t("list.deleteMessage"),
      confirm: t("list.delete"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    setFailed(false);
    remove.mutate(a.id, { onError: () => setFailed(true) });
  };
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={a.name}
        onPress={() =>
          router.push({ pathname: "/admin/members/[id]", params: { id: a.id } })
        }
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <Text weight="medium" numberOfLines={1}>
          {a.name}
        </Text>
        <View style={styles.badges}>
          <Badge
            tone="amber"
            label={a.type ? t(`types.${a.type}`) : t("list.typeUnknown")}
          />
        </View>
        {a.email ? (
          <Text variant="caption" tone="muted" numberOfLines={1} selectable>
            {a.email}
          </Text>
        ) : null}
        <Text variant="caption" tone="subtle">
          {t("list.createdAt", { date: formatDate(a.createdAt, locale) })}
        </Text>
        {failed ? <ErrorText text="" /> : null}
      </Pressable>
      <Button
        compact
        variant="secondary"
        label={t("list.delete")}
        icon={(c) => <Trash2 color={c} size={16} aria-hidden />}
        loading={remove.isPending}
        onPress={() => void onDelete()}
      />
    </View>
  );
}

function Heading({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof UserPlus;
  title: string;
  count?: number;
}) {
  return (
    <View style={styles.heading}>
      <Icon color={colors.brand700} size={20} aria-hidden />
      <Text variant="subheading" accessibilityRole="header">
        {title}
      </Text>
      {count !== undefined ? (
        <Badge tone="brand" label={String(count)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.sm,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  chipPressed: { backgroundColor: colors.slate100 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
  },
  rowMain: { flex: 1, gap: 2, minHeight: 44 },
  pressed: { opacity: 0.6 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
