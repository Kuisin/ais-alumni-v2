import type {
  AccessPosition,
  AccessType,
  DirectRuleValue,
  MyAccess,
} from "@contract/core";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { Check, Minus } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { api } from "@/lib/api";
import {
  Badge,
  Card,
  colors,
  QueryState,
  Screen,
  Section,
  space,
  Text,
} from "@/ui";
import { Table, type TableColumn } from "@/ui/table";

const TYPES: AccessType[] = [
  "TEACHER_CURRENT",
  "TEACHER_FORMER",
  "CURRENT_STUDENT",
  "GRADUATE",
  "LEFT_STUDENT",
  "CURRENT_PARENT",
  "FORMER_PARENT",
];

const POSITIONS: AccessPosition[] = [
  "ALUMNI_COMMITTEE",
  "STUDENT_LEADER",
  "TEACHER_REGISTRAR",
  "TEACHER_MANAGER",
];

/** The 1:1 setting that applies to a non-teacher type. */
function ruleFor(
  type: AccessType,
  rules: MyAccess["directRules"],
): DirectRuleValue {
  if (type === "GRADUATE" || type === "LEFT_STUDENT")
    return rules.FORMER_STUDENT;
  return rules[type as keyof MyAccess["directRules"]];
}

/**
 * 利用できる機能 (マイページ): the member's own type and positions, then
 * tables of what each type and position may use, the member's rows
 * highlighted. The server's rules (authz, direct-policy, permissions) say
 * the same; this only shows them. Admins aren't listed.
 */
export default function AccessScreen() {
  const t = useTranslations("mobile.access");
  const access = useQuery({
    queryKey: ["me", "access"],
    queryFn: () => api<MyAccess>("/me/access"),
  });
  return (
    <Screen
      refreshing={access.isRefetching}
      onRefresh={() => void access.refetch()}
    >
      <Stack.Screen options={{ title: t("title") }} />
      <Text tone="muted">{t("intro")}</Text>
      <QueryState query={access}>
        {(data) => <AccessTables data={data} />}
      </QueryState>
    </Screen>
  );
}

function AccessTables({ data }: { data: MyAccess }) {
  const t = useTranslations("mobile.access");
  const tr = useTranslations("roles");
  const tp = useTranslations("broadcast.positions");
  const mine = new Set(data.types);
  const held = new Map(data.positions.map((p) => [p.key, p.cohort]));

  const typeLabel = (k: AccessType) =>
    k === "TEACHER_CURRENT"
      ? tr("teacherStatus.CURRENT")
      : k === "TEACHER_FORMER"
        ? tr("teacherStatus.FORMER")
        : tr(`audience.${k}`);

  const yes = (label: string) => (
    <View style={styles.mark}>
      <Check size={16} color={colors.green600} aria-hidden />
      <Text variant="small">{label}</Text>
    </View>
  );
  const no = (label: string) => (
    <View style={styles.mark}>
      <Minus size={16} color={colors.slate400} aria-hidden />
      <Text variant="small" tone="muted">
        {label}
      </Text>
    </View>
  );
  const firstCell = (label: string, own: boolean) => (
    <View style={styles.first}>
      <Text variant="small" weight="semibold">
        {label}
      </Text>
      {own ? <Badge label={t("you")} tone="brand" /> : null}
    </View>
  );

  const typeColumns: TableColumn[] = [
    { key: "type", label: t("types.columns.type"), width: 150 },
    { key: "directory", label: t("types.columns.directory"), width: 120 },
    { key: "direct", label: t("types.columns.direct"), width: 170 },
    { key: "profile", label: t("types.columns.profile"), width: 210 },
    { key: "create", label: t("types.columns.create"), width: 190 },
  ];
  const typeRows = TYPES.map((k) => {
    const teacher = k === "TEACHER_CURRENT" || k === "TEACHER_FORMER";
    const directory = k !== "TEACHER_FORMER";
    const rule = teacher ? null : ruleFor(k, data.directRules);
    const direct = teacher
      ? t(`types.direct.${k}`)
      : t(`types.direct.${rule as DirectRuleValue}`);
    const profile =
      k === "CURRENT_STUDENT"
        ? t("types.profile.minor")
        : t("types.profile.member");
    const create =
      k === "TEACHER_CURRENT"
        ? t("types.create.teacher")
        : t("types.create.position");
    return {
      key: k,
      highlight: mine.has(k),
      label: [
        typeLabel(k),
        mine.has(k) ? t("you") : null,
        `${t("types.columns.directory")}: ${directory ? t("types.yes") : t("types.no")}`,
        `${t("types.columns.direct")}: ${direct}`,
        `${t("types.columns.profile")}: ${profile}`,
        `${t("types.columns.create")}: ${create}`,
      ]
        .filter(Boolean)
        .join(", "),
      cells: [
        firstCell(typeLabel(k), mine.has(k)),
        directory ? yes(t("types.yes")) : no(t("types.no")),
        rule === "NOBODY" ? no(direct) : yes(direct),
        profile,
        k === "TEACHER_CURRENT" ? yes(create) : no(create),
      ],
    };
  });

  const positionColumns: TableColumn[] = [
    {
      key: "position",
      label: t("positionsTable.columns.position"),
      width: 160,
    },
    { key: "who", label: t("positionsTable.columns.who"), width: 170 },
    { key: "can", label: t("positionsTable.columns.can"), width: 280 },
  ];
  const positionRows = POSITIONS.map((k) => {
    const own = held.has(k);
    const cohort = held.get(k);
    const name = cohort ? `${tp(k)}（${cohort}）` : tp(k);
    return {
      key: k,
      highlight: own,
      label: [
        name,
        own ? t("you") : null,
        `${t("positionsTable.columns.who")}: ${t(`positionsTable.who.${k}`)}`,
        `${t("positionsTable.columns.can")}: ${t(`positionsTable.can.${k}`)}`,
      ]
        .filter(Boolean)
        .join(", "),
      cells: [
        firstCell(name, own),
        t(`positionsTable.who.${k}`),
        t(`positionsTable.can.${k}`),
      ],
    };
  });

  const everyone = t.raw("everyone.rows") as [string, string][];
  const notes = t.raw("types.notes") as string[];

  return (
    <>
      <Card style={styles.card}>
        <Text variant="subheading" accessibilityRole="header">
          {t("mine.title")}
        </Text>
        <View style={styles.line}>
          <Text variant="small" tone="muted" style={styles.lineLabel}>
            {t("mine.types")}
          </Text>
          <View style={styles.badges}>
            {data.types.map((k) => (
              <Badge key={k} label={typeLabel(k)} tone="brand" />
            ))}
          </View>
        </View>
        <View style={styles.line}>
          <Text variant="small" tone="muted" style={styles.lineLabel}>
            {t("mine.positions")}
          </Text>
          <View style={styles.badges}>
            {data.positions.length ? (
              data.positions.map((p) => (
                <Badge
                  key={p.key}
                  label={p.cohort ? `${tp(p.key)}（${p.cohort}）` : tp(p.key)}
                  tone="green"
                />
              ))
            ) : (
              <Text variant="small" tone="subtle">
                {t("mine.noPositions")}
              </Text>
            )}
          </View>
        </View>
        {data.minor ? (
          <Text variant="small" tone="muted">
            {t("mine.minor")}
          </Text>
        ) : null}
      </Card>

      <Section title={t("types.title")}>
        <Table
          columns={typeColumns}
          rows={typeRows}
          caption={t("types.caption")}
        />
        {notes.map((n) => (
          <View key={n} style={styles.note}>
            <Text variant="small" tone="subtle" aria-hidden>
              •
            </Text>
            <Text variant="small" tone="subtle" style={styles.flex}>
              {n}
            </Text>
          </View>
        ))}
      </Section>

      <Section title={t("positionsTable.title")}>
        <Table columns={positionColumns} rows={positionRows} />
        <Text variant="small" tone="subtle">
          {t("positionsTable.note")}
        </Text>
      </Section>

      <Section title={t("everyone.title")}>
        <Table
          columns={[
            {
              key: "feature",
              label: t("everyone.columns.feature"),
              width: 130,
            },
            { key: "detail", label: t("everyone.columns.detail"), width: 260 },
          ]}
          rows={everyone.map(([feature, detail]) => ({
            key: feature,
            cells: [feature, detail],
          }))}
        />
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space.md },
  line: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  lineLabel: { minWidth: 72, paddingTop: 2 },
  badges: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  first: { gap: space.xs, alignItems: "flex-start" },
  mark: { flexDirection: "row", gap: space.xs, alignItems: "center" },
  note: { flexDirection: "row", gap: space.sm },
});
