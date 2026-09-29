import type { BroadcastHistoryItem } from "@contract/admin-notify";
import type { Locale } from "@contract/core";
import { Stack, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { useNotifyPage } from "@/features/admin/notify/api";
import { BroadcastForm } from "@/features/admin/notify/broadcast-form";
import { useAudienceText } from "@/features/admin/notify/parts";
import { ReadMeter, readPercent } from "@/features/admin/notify/receipts";
import { Chips } from "@/features/people/choices";
import { formatDateTime } from "@/lib/format";
import {
  Badge,
  Card,
  colors,
  EmptyState,
  QueryState,
  Screen,
  space,
  Text,
} from "@/ui";

/**
 * 一斉通知 (the website's /app/admin/notify): send a message to members —
 * admins and teacher managers to anyone, student leaders to their own class
 * — and the history with read counts (admins: every sender's too).
 */
export default function NotifyScreen() {
  const t = useTranslations("broadcast");
  const [all, setAll] = useState(false);
  const query = useNotifyPage(all);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: t("pageTitle") }} />
      <QueryState query={query}>
        {(page) => (
          <Screen refreshing={refreshing} onRefresh={refresh}>
            <Text variant="small" tone="muted">
              {page.canAny ? t("descriptionAny") : t("descriptionLeader")}
            </Text>
            <Card>
              <BroadcastForm page={page} />
            </Card>
            {page.history.length || page.isAdmin ? (
              <Card style={styles.history}>
                <Text variant="subheading" accessibilityRole="header">
                  {t("history")}
                </Text>
                {page.isAdmin ? (
                  <Chips
                    label={t("historyTabs")}
                    choices={[
                      { value: "mine", label: t("historyMine") },
                      { value: "all", label: t("historyAll") },
                    ]}
                    value={page.showAll ? "all" : "mine"}
                    onChange={(v) => setAll(v === "all")}
                  />
                ) : null}
                {page.history.length === 0 ? (
                  <EmptyState title={t("historyEmpty")} />
                ) : (
                  <View>
                    {page.history.map((b, i) => (
                      <HistoryRow key={b.id} item={b} first={i === 0} />
                    ))}
                  </View>
                )}
              </Card>
            ) : null}
          </Screen>
        )}
      </QueryState>
    </>
  );
}

function HistoryRow({
  item: b,
  first,
}: {
  item: BroadcastHistoryItem;
  first: boolean;
}) {
  const t = useTranslations("broadcast");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const audience = useAudienceText();
  const c = b.receipts;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={b.title}
      onPress={() => router.push(`/admin/notify/${b.id}`)}
      style={({ pressed }) => [
        styles.row,
        first ? null : styles.rowBorder,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.rowBody}>
        <Text weight="medium">{b.title}</Text>
        {b.archived || b.edited ? (
          <View style={styles.badges}>
            {b.archived ? (
              <Badge tone="amber" label={t("manage.archivedBadge")} />
            ) : null}
            {b.edited ? <Badge label={t("manage.editedBadge")} /> : null}
          </View>
        ) : null}
        <Text variant="small" tone="muted">
          {`${formatDateTime(b.createdAt, locale)} · ${audience(b.audience)}`}
        </Text>
        {b.sender ? (
          <Text variant="small" tone="muted">
            {t("sentBy", { name: b.sender })}
          </Text>
        ) : null}
        <Text variant="caption" tone="subtle">
          {t("historyCounts", {
            recipients: b.recipientCount,
            line: b.lineCount,
            email: b.emailCount,
          })}
        </Text>
        <View style={styles.meter}>
          {c ? (
            <ReadMeter
              read={c.read}
              total={c.total}
              label={t("receipts.readOf", c)}
              percentLabel={t("receipts.percent", {
                percent: readPercent(c.read, c.total),
              })}
            />
          ) : (
            <Text
              variant="caption"
              tone="subtle"
              accessibilityLabel={t("receipts.none")}
            >
              —
            </Text>
          )}
        </View>
      </View>
      <ChevronRight size={18} color={colors.slate400} aria-hidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  history: { gap: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate200,
  },
  pressed: { backgroundColor: colors.slate50 },
  rowBody: { flex: 1, gap: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  meter: { marginTop: space.xs, maxWidth: 240 },
});
