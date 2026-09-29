import type { DestinationPerson } from "@contract/admin-manage";
import { Stack, useRouter } from "expo-router";
import {
  Briefcase,
  GraduationCap,
  Megaphone,
  School,
  Users,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { useTranslations } from "use-intl";
import { ChoiceList, SelectField } from "@/features/people/choices";
import { Sheet } from "@/features/people/sheet";
import { hrefFor } from "@/lib/links";
import {
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  QueryState,
  Screen,
  space,
  Text,
  TOUCH,
} from "@/ui";
import { type DestinationParams, useAdminDestinations } from "./api";
import { BarTable, StatCard } from "./parts";

/** 進路: where former students went after AIS (/app/admin/destinations). */
export function AdminDestinationsScreen() {
  const t = useTranslations("destinations");
  const router = useRouter();
  const [params, setParams] = useState<DestinationParams>({
    cohort: "",
    hist: null,
    all: false,
  });
  const [picking, setPicking] = useState(false);
  const query = useAdminDestinations(params);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  const askHref = hrefFor("/app/news/new");

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {(d) => {
          const cohortLabel =
            d.cohorts.find((c) => c.id === d.cohortId)?.label ??
            t("allCohorts");
          return (
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
              <Text variant="small" tone="muted">
                {t("description")}
              </Text>
              <Card style={styles.filters}>
                <SelectField
                  label={t("cohort")}
                  value={cohortLabel}
                  onPress={() => setPicking(true)}
                />
                <View style={styles.switchRow}>
                  <Text variant="small" style={styles.flex}>
                    {t("onlyHistory")}
                  </Text>
                  <Switch
                    accessibilityLabel={t("onlyHistory")}
                    value={d.onlyHistory}
                    onValueChange={(v) =>
                      setParams((p) => ({ ...p, hist: v, all: false }))
                    }
                    trackColor={{ true: colors.brand600 }}
                  />
                </View>
              </Card>
              <Sheet
                visible={picking}
                onClose={() => setPicking(false)}
                title={t("cohort")}
              >
                <ChoiceList
                  label={t("cohort")}
                  choices={[
                    { value: "", label: t("allCohorts") },
                    ...d.cohorts.map((c) => ({ value: c.id, label: c.label })),
                  ]}
                  value={d.cohortId}
                  onChange={(cohort) => {
                    setPicking(false);
                    setParams((p) => ({
                      cohort,
                      hist: p.hist ?? d.onlyHistory,
                      all: false,
                    }));
                  }}
                />
              </Sheet>

              <StatCard
                icon={<Users size={32} color={colors.brand700} aria-hidden />}
                label={t("formerStudents")}
                value={String(d.formerStudents)}
              />
              <StatCard
                icon={<School size={32} color={colors.brand700} aria-hidden />}
                label={t("withHistory")}
                value={String(d.withHistory)}
                sub={
                  d.formerStudents
                    ? t("rate", {
                        percent: Math.round(
                          (d.withHistory / d.formerStudents) * 100,
                        ),
                      })
                    : "—"
                }
              />

              {d.withHistory === 0 ? (
                <EmptyState
                  icon={
                    <GraduationCap
                      size={28}
                      color={colors.slate400}
                      aria-hidden
                    />
                  }
                  title={t("noHistory")}
                  hint={t("noHistoryHint")}
                  action={
                    askHref ? (
                      <Button
                        variant="secondary"
                        label={t("askMembers")}
                        icon={(c) => (
                          <Megaphone size={16} color={c} aria-hidden />
                        )}
                        onPress={() => router.push(askHref)}
                      />
                    ) : undefined
                  }
                />
              ) : (
                <View
                  style={styles.charts}
                  accessibilityLabel={t("chartsLabel")}
                >
                  <Text variant="small" tone="muted">
                    {t("chartNote")}
                  </Text>
                  {d.charts.map((c) => (
                    <BarTable key={c.id} chart={c} />
                  ))}
                </View>
              )}

              <Card style={styles.people}>
                <Text variant="subheading" accessibilityRole="header">
                  {t("table.title")}
                </Text>
                <Text variant="small" tone="muted">
                  {t("table.count", {
                    shown: d.people.length,
                    total: d.listed,
                  })}
                </Text>
                <Text variant="small" tone="muted">
                  {t("table.hint")}
                </Text>
                {d.people.length ? (
                  d.people.map((p, i) => (
                    <PersonRow key={p.id} person={p} first={i === 0} />
                  ))
                ) : (
                  <EmptyState title={t("table.empty")} />
                )}
                {d.people.length < d.listed ? (
                  <Button
                    variant="secondary"
                    label={t("table.showAll", { count: d.listed })}
                    loading={query.isFetching && params.all}
                    onPress={() =>
                      setParams((p) => ({
                        ...p,
                        hist: p.hist ?? d.onlyHistory,
                        all: true,
                      }))
                    }
                  />
                ) : null}
              </Card>
            </Screen>
          );
        }}
      </QueryState>
    </>
  );
}

/** One person: name (opens the admin member page), 学年, schools, now. */
function PersonRow({
  person: p,
  first,
}: {
  person: DestinationPerson;
  first: boolean;
}) {
  const t = useTranslations("destinations");
  const router = useRouter();
  const href = hrefFor(`/app/admin/members/${p.id}`);
  return (
    <View style={[styles.person, first ? null : styles.personBorder]}>
      <View style={styles.personHead}>
        {href ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(href)}
            style={styles.nameLink}
          >
            <Text weight="medium" tone="brand" numberOfLines={1}>
              {p.name}
            </Text>
          </Pressable>
        ) : (
          <Text weight="medium" numberOfLines={1} style={styles.flex}>
            {p.name}
          </Text>
        )}
        <Text variant="caption" tone="subtle">
          {p.cohort}
        </Text>
      </View>
      {p.left ? (
        <Text variant="caption" tone="subtle">
          {p.left}
        </Text>
      ) : null}
      {p.schools.map((s) => (
        <View key={s.level} style={styles.fact}>
          <Text variant="small" tone="subtle" style={styles.factLabel}>
            {s.label}
          </Text>
          <Text
            variant="small"
            tone={s.name ? "default" : "subtle"}
            style={styles.flex}
          >
            {s.name ?? "—"}
          </Text>
        </View>
      ))}
      <View style={styles.fact}>
        <Text variant="small" tone="subtle" style={styles.factLabel}>
          {t("table.now")}
        </Text>
        <View style={[styles.flex, styles.now]}>
          {p.now ? (
            <>
              {p.now.kind === "work" ? (
                <Briefcase size={16} color={colors.slate500} aria-hidden />
              ) : (
                <School size={16} color={colors.slate500} aria-hidden />
              )}
              <Text variant="small" style={styles.flex}>
                {p.now.name}
              </Text>
            </>
          ) : p.hasHistory ? (
            <Text variant="small" tone="subtle">
              —
            </Text>
          ) : (
            <Badge label={t("table.noHistory")} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { gap: space.md },
  switchRow: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  charts: { gap: space.md },
  people: { gap: space.sm },
  person: { paddingVertical: space.md, gap: space.xs },
  personBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate200,
  },
  personHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  nameLink: { flex: 1, minHeight: TOUCH, justifyContent: "center" },
  fact: { flexDirection: "row", gap: space.md },
  factLabel: { width: 96 },
  now: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
