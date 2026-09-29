import type { AdminEventRow } from "@contract/admin-events";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, ChevronRight, Plus } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAdminEvents } from "@/features/admin/events/api";
import { AudienceBadges } from "@/features/admin/events/parts";
import { FallbackTag, Notice } from "@/features/events/parts";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import {
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  QueryState,
  Screen,
  Section,
  space,
  Text,
} from "@/ui";

/**
 * イベント管理 (the website's /app/admin/events): upcoming events and the
 * last 30 past ones the member manages, with status and headcount.
 */
export default function AdminEventsScreen() {
  const t = useTranslations("adminContent.events");
  const router = useRouter();
  const { deleted } = useLocalSearchParams<{ deleted?: string }>();
  const query = useAdminEvents();
  const [refreshing, setRefreshing] = useState(false);
  // Creating an event is the compose screen (when the app has it).
  const newHref = hrefFor("/app/events/new");

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  const newButton = (variant: "primary" | "secondary") =>
    newHref ? (
      <Button
        variant={variant}
        label={t("new")}
        icon={(c) => <Plus size={16} color={c} aria-hidden />}
        onPress={() => router.push(newHref)}
        style={styles.start}
      />
    ) : null;

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {(data) => (
          <Screen refreshing={refreshing} onRefresh={refresh}>
            <Text variant="small" tone="muted">
              {data.isAdmin ? t("description") : t("descriptionOwn")}
            </Text>
            {newButton("primary")}
            {deleted === "1" ? (
              <Notice tone="success">{t("deleted")}</Notice>
            ) : null}
            <Section title={t("upcoming")}>
              {data.upcoming.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={
                      <CalendarDays
                        size={32}
                        color={colors.slate400}
                        aria-hidden
                      />
                    }
                    title={t("empty")}
                    hint={t("emptyHint")}
                    action={newButton("secondary")}
                  />
                </Card>
              ) : (
                <EventRows events={data.upcoming} />
              )}
            </Section>
            <Section title={t("past", { limit: data.pastLimit })}>
              {data.past.length === 0 ? (
                <Card>
                  <Text variant="small" tone="subtle" center>
                    {t("emptyPast")}
                  </Text>
                </Card>
              ) : (
                <EventRows events={data.past} />
              )}
            </Section>
          </Screen>
        )}
      </QueryState>
    </>
  );
}

const STATUS_TONE = { open: "green", closed: "slate", full: "amber" } as const;

function EventRows({ events }: { events: AdminEventRow[] }) {
  const t = useTranslations("adminContent");
  const router = useRouter();
  const { locale } = useAuth();
  return (
    <Card padded={false} style={styles.list}>
      {events.map((e, i) => {
        const title = e.title.text || "—";
        const when = formatDateTime(e.startsAt, locale);
        return (
          <Card
            key={e.id}
            padded={false}
            accessibilityLabel={`${title}、${when}`}
            onPress={() =>
              router.push({
                pathname: "/admin/events/[id]",
                params: { id: e.id },
              })
            }
            style={i > 0 ? { ...styles.row, ...styles.rowBorder } : styles.row}
          >
            <View style={styles.rowBody}>
              <View style={styles.meta}>
                {e.status ? (
                  <Badge
                    tone={STATUS_TONE[e.status]}
                    label={t(`events.status.${e.status}`)}
                  />
                ) : null}
                {e.awaitingApproval ? (
                  <Badge
                    tone="amber"
                    label={t("news.status.awaitingApproval")}
                  />
                ) : null}
                <Text variant="small" tone="muted">
                  {when}
                </Text>
              </View>
              <Text weight="semibold">
                {title}
                <FallbackTag fallback={e.title.fallback} />
              </Text>
              <View style={styles.meta}>
                <Text variant="small" tone="muted">
                  {e.capacity === null
                    ? t("events.goingCount", { going: e.going })
                    : t("events.goingOfCapacity", {
                        going: e.going,
                        capacity: e.capacity,
                      })}
                </Text>
                <AudienceBadges audience={e.audience} />
              </View>
            </View>
            <ChevronRight size={20} color={colors.slate400} aria-hidden />
          </Card>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: "flex-start" },
  list: { overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderWidth: 0,
    borderRadius: 0,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowBody: { flex: 1, gap: space.xs },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
});
