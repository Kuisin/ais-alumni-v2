import type {
  AdminChatReport,
  AuditPerson,
  DirectChatRule,
} from "@contract/admin-manage";
import { Stack, useRouter } from "expo-router";
import { Flag, MessagesSquare, UserRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { Notice, SegmentedTabs } from "@/features/events/parts";
import { ChoiceList, SelectField } from "@/features/people/choices";
import { Sheet } from "@/features/people/sheet";
import { formatDateTime } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import {
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  QueryState,
  radius,
  Screen,
  space,
  Text,
  TOUCH,
} from "@/ui";
import {
  adminManageApi,
  type InboxTab,
  useAdminChat,
  useRefreshAdmin,
} from "./api";
import { Facts } from "./parts";

const RULE_VALUES: DirectChatRule[] = ["ANYONE", "SAME_ROLE", "NOBODY"];

/**
 * Chat moderation (the website's /app/admin/chat): who each member type may
 * have 1:1 talks with, and the reports members sent from a chat's details.
 */
export function AdminChatScreen() {
  const t = useTranslations("chat.admin");
  const [tab, setTab] = useState<InboxTab>("open");
  const query = useAdminChat(tab);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  const counts = query.data?.counts;
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {(d) => (
          <Screen refreshing={refreshing} onRefresh={onRefresh}>
            <Text variant="small" tone="muted">
              {t("intro")}
            </Text>
            <Card style={styles.card}>
              <Text variant="subheading" accessibilityRole="header">
                {t("rulesTitle")}
              </Text>
              <Text variant="small" tone="muted">
                {t("rulesIntro")}
              </Text>
              <RulesForm rules={d.rules} roles={d.ruleRoles} />
            </Card>

            <Text variant="subheading" accessibilityRole="header">
              {t("reportsTitle")}
            </Text>
            <SegmentedTabs<InboxTab>
              label={t("reportsTitle")}
              items={(["open", "closed"] as const).map((k) => ({
                key: k,
                label: counts ? `${t(k)} (${counts[k]})` : t(k),
              }))}
              value={tab}
              onChange={setTab}
            />
            {d.reports.length === 0 ? (
              <EmptyState
                icon={<Flag size={28} color={colors.slate400} aria-hidden />}
                title={d.tab === "open" ? t("emptyOpen") : t("emptyClosed")}
              />
            ) : (
              d.reports.map((r) => <ReportCard key={r.id} report={r} />)
            )}
          </Screen>
        )}
      </QueryState>
    </>
  );
}

/** Who each member type may have 1:1 talks with. */
function RulesForm({
  rules,
  roles,
}: {
  rules: Record<string, DirectChatRule>;
  roles: string[];
}) {
  const t = useTranslations("chat.admin");
  const tr = useTranslations("roles.role");
  const refresh = useRefreshAdmin();
  const [values, setValues] = useState(rules);
  const [picking, setPicking] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<"saved" | "error" | null>(null);
  useEffect(() => setValues(rules), [rules]);

  const save = async () => {
    setSaving(true);
    setState(null);
    try {
      const r = await adminManageApi.saveChatRules({ rules: values });
      setState(r.ok ? "saved" : "error");
      if (r.ok) await refresh("chat");
    } catch {
      setState("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      {roles.map((role) => (
        <SelectField
          key={role}
          label={tr(role)}
          value={t(`rules.${values[role] ?? "ANYONE"}`)}
          onPress={() => setPicking(role)}
        />
      ))}
      <Sheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking ? tr(picking) : undefined}
      >
        {picking ? (
          <ChoiceList
            label={tr(picking)}
            choices={RULE_VALUES.map((v) => ({
              value: v,
              label: t(`rules.${v}`),
            }))}
            value={values[picking] ?? "ANYONE"}
            onChange={(v) => {
              const role = picking;
              setPicking(null);
              setValues((prev) => ({ ...prev, [role]: v as DirectChatRule }));
            }}
          />
        ) : null}
      </Sheet>
      {state === "saved" ? <Notice tone="success">{t("saved")}</Notice> : null}
      {state === "error" ? (
        <Notice tone="error">{t("saveError")}</Notice>
      ) : null}
      <Button
        label={saving ? t("saving") : t("save")}
        loading={saving}
        onPress={save}
      />
    </View>
  );
}

function ReportCard({ report: r }: { report: AdminChatReport }) {
  const t = useTranslations("chat.admin");
  const tc = useTranslations("chat");
  const locale = useLocale() === "en" ? "en" : "ja";
  const router = useRouter();
  const refresh = useRefreshAdmin();
  const [saving, setSaving] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const chatHref =
    r.chat && !r.chat.direct ? hrefFor(`/app/chat/${r.chat.id}`) : null;

  const toggle = async () => {
    setSaving(true);
    try {
      await adminManageApi.setChatReportClosed(r.id, !r.closedAt);
      await refresh("chat");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Badge label={tc(`report.reasons.${r.reason}`)} tone="red" />
      </View>
      <Text variant="caption" tone="subtle">
        #{r.ref} · {formatDateTime(r.createdAt, locale)}
      </Text>
      <Facts
        rows={[
          {
            label: t("chat"),
            value: (
              <View style={styles.inline}>
                <MessagesSquare size={14} color={colors.slate500} aria-hidden />
                {!r.chat ? (
                  <Text variant="small">{t("chatGone")}</Text>
                ) : chatHref ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.push(chatHref)}
                    hitSlop={8}
                  >
                    <Text variant="small" tone="brand">
                      {r.chat.name}
                    </Text>
                  </Pressable>
                ) : (
                  <Text variant="small">{r.chat.name}</Text>
                )}
              </View>
            ),
          },
          { label: t("reporter"), value: <MemberLink person={r.reporter} /> },
          {
            label: t("reported"),
            value: r.wholeChat ? (
              t("wholeChat")
            ) : (
              <MemberLink person={r.reported} />
            ),
          },
          ...(r.closedAt
            ? [
                {
                  label: t("closedAt"),
                  value: formatDateTime(r.closedAt, locale),
                },
              ]
            : []),
        ]}
      />
      <Text variant="small" selectable>
        {r.detail}
      </Text>
      {r.messages.length ? (
        <View style={styles.messages}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showMessages }}
            onPress={() => setShowMessages((v) => !v)}
            style={styles.messagesToggle}
          >
            <Text variant="small" weight="medium">
              {t("messages", { count: r.messages.length })}
            </Text>
          </Pressable>
          {showMessages
            ? r.messages.map((m) => (
                <View key={m.id} style={styles.message}>
                  <Text variant="small">
                    <Text variant="small" weight="medium">
                      {m.name}
                    </Text>{" "}
                    <Text variant="caption" tone="subtle">
                      {formatDateTime(m.createdAt, locale)}
                    </Text>
                  </Text>
                  <Text variant="small" selectable>
                    {m.body}
                  </Text>
                </View>
              ))
            : null}
        </View>
      ) : null}
      <Button
        variant="secondary"
        label={r.closedAt ? t("reopen") : t("close")}
        loading={saving}
        onPress={toggle}
        style={styles.closeButton}
      />
    </Card>
  );
}

function MemberLink({ person }: { person: AuditPerson | null }) {
  const router = useRouter();
  if (!person)
    return (
      <Text variant="small" tone="subtle">
        —
      </Text>
    );
  const href = hrefFor(`/app/admin/members/${person.id}`);
  if (!href) return <Text variant="small">{person.label}</Text>;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      style={styles.inline}
      hitSlop={8}
    >
      <UserRound size={14} color={colors.brand700} aria-hidden />
      <Text variant="small" tone="brand">
        {person.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  form: { gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  inline: { flexDirection: "row", alignItems: "center", gap: 4 },
  messages: {
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    gap: space.sm,
  },
  messagesToggle: { minHeight: TOUCH, justifyContent: "center" },
  message: { gap: 2 },
  closeButton: { alignSelf: "flex-start" },
});
