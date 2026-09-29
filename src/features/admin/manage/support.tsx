import type { AdminSupportRequest } from "@contract/admin-manage";
import { Stack, useRouter } from "expo-router";
import { Mail, UserRound } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { SegmentedTabs } from "@/features/events/parts";
import { formatDateTime } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import {
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  font,
  QueryState,
  Screen,
  space,
  Text,
} from "@/ui";
import {
  adminManageApi,
  type InboxTab,
  useAdminSupport,
  useRefreshAdmin,
} from "./api";
import { Facts } from "./parts";

const TONE = {
  ISSUE: "red",
  QUESTION: "brand",
  COMPLAINT: "amber",
  FEATURE: "green",
} as const;

/** お問い合わせ inbox: open requests first; reply by email, then close. */
export function AdminSupportScreen() {
  const t = useTranslations("support");
  const [tab, setTab] = useState<InboxTab>("open");
  const query = useAdminSupport(tab);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  const counts = query.data?.counts;
  return (
    <>
      <Stack.Screen options={{ title: t("admin.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Text variant="small" tone="muted">
          {t("admin.intro")}
        </Text>
        <SegmentedTabs<InboxTab>
          label={t("admin.title")}
          items={(["open", "closed"] as const).map((k) => ({
            key: k,
            label: counts
              ? `${t(`admin.${k}`)} (${counts[k]})`
              : t(`admin.${k}`),
          }))}
          value={tab}
          onChange={setTab}
        />
        <QueryState query={query}>
          {(d) =>
            d.requests.length === 0 ? (
              <EmptyState
                icon={<Mail size={28} color={colors.slate400} aria-hidden />}
                title={
                  d.tab === "open"
                    ? t("admin.emptyOpen")
                    : t("admin.emptyClosed")
                }
              />
            ) : (
              <View style={styles.list}>
                {d.requests.map((r) => (
                  <RequestCard key={r.id} request={r} />
                ))}
              </View>
            )
          }
        </QueryState>
      </Screen>
    </>
  );
}

function RequestCard({ request: r }: { request: AdminSupportRequest }) {
  const t = useTranslations("support");
  const locale = useLocale() === "en" ? "en" : "ja";
  const router = useRouter();
  const refresh = useRefreshAdmin();
  const [saving, setSaving] = useState(false);
  const type = r.type as keyof typeof TONE;
  const reply = `mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.subject} [${r.ref}]`)}`;
  const memberHref = r.member
    ? hrefFor(`/app/admin/members/${r.member.id}`)
    : null;

  const toggle = async () => {
    setSaving(true);
    try {
      await adminManageApi.setSupportClosed(r.id, !r.closedAt);
      await refresh("support");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Badge
          label={t(`types.${r.type}.label`)}
          tone={TONE[type] ?? "slate"}
        />
        <Text variant="small" tone="muted">
          {t(`types.${r.type}.topics.${r.topic}`)}
        </Text>
      </View>
      <Text variant="caption" tone="subtle">
        #{r.ref} · {formatDateTime(r.createdAt, locale)}
      </Text>
      <Text variant="subheading" selectable>
        {r.subject}
      </Text>
      <Text variant="small" selectable>
        {r.message}
      </Text>
      <Facts
        rows={[
          {
            label: t("form.name"),
            value: (
              <View style={styles.nameRow}>
                <Text variant="small" selectable>
                  {r.name}
                </Text>
                {r.member ? (
                  memberHref ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => router.push(memberHref)}
                      style={styles.member}
                      hitSlop={8}
                    >
                      <UserRound
                        size={14}
                        color={colors.brand700}
                        aria-hidden
                      />
                      <Text variant="small" tone="brand">
                        {r.member.label}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text variant="small" tone="muted">
                      {r.member.label}
                    </Text>
                  )
                ) : (
                  <Badge label={t("admin.visitor")} />
                )}
              </View>
            ),
          },
          { label: t("form.email"), value: r.email },
          ...(r.page
            ? [
                {
                  label: t("admin.page"),
                  value: (
                    <Text
                      variant="caption"
                      selectable
                      style={{ fontFamily: font.mono }}
                    >
                      {r.page}
                    </Text>
                  ),
                },
              ]
            : []),
          {
            label: t("admin.language"),
            value: r.locale === "en" ? "English" : "日本語",
          },
          ...(r.closedAt
            ? [
                {
                  label: t("admin.closedAt"),
                  value: formatDateTime(r.closedAt, locale),
                },
              ]
            : []),
        ]}
      />
      <View style={styles.actions}>
        <Button
          label={t("admin.reply")}
          icon={(c) => <Mail size={16} color={c} aria-hidden />}
          onPress={() => Linking.openURL(reply).catch(() => {})}
        />
        <Button
          variant="secondary"
          label={r.closedAt ? t("admin.reopen") : t("admin.close")}
          loading={saving}
          onPress={toggle}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  card: { gap: space.sm },
  head: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  nameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  member: { flexDirection: "row", alignItems: "center", gap: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
