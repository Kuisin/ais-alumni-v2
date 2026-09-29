import type { AuditEntry } from "@contract/admin-manage";
import { Stack, useRouter } from "expo-router";
import { History } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { ChoiceList, SelectField } from "@/features/people/choices";
import { Sheet } from "@/features/people/sheet";
import { formatDate, formatTime, TIME_ZONE } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import {
  Button,
  Card,
  colors,
  EmptyState,
  ErrorState,
  font,
  Loading,
  radius,
  Screen,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";
import { useAdminAudit } from "./api";

/** Action prefixes offered in the filter (the website's AUDIT_CATEGORIES). */
const CATEGORIES = [
  "member",
  "verification",
  "teacher",
  "record_request",
  "event",
  "news",
  "broadcast",
  "cohort",
  "roster",
  "school",
  "company",
  "self",
  "user",
] as const;

/** JST calendar day (YYYY-MM-DD) for grouping rows. */
function jstDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** 操作ログ (the website's /app/admin/audit), newest first. */
export function AdminAuditScreen() {
  const t = useTranslations("adminMembers.auditLog");
  const ta = useTranslations("audit");
  const tc = useTranslations("common");
  const [action, setAction] = useState("");
  const [targetText, setTargetText] = useState("");
  const [target, setTarget] = useState("");
  const [picking, setPicking] = useState(false);
  const query = useAdminAudit(action, target);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  const entries = query.data?.pages.flatMap((p) => p.entries) ?? [];
  const actionLabel = action
    ? ta(`categories.${action.replace(/\.$/, "")}`)
    : ta("allActions");

  const groups: { day: string; date: string; rows: AuditEntry[] }[] = [];
  for (const r of entries) {
    const day = jstDayKey(r.createdAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.rows.push(r);
    else groups.push({ day, date: r.createdAt, rows: [r] });
  }

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Text variant="small" tone="muted">
          {t("description")}
        </Text>
        <Card style={styles.filters}>
          <SelectField
            label={ta("category")}
            value={actionLabel}
            onPress={() => setPicking(true)}
          />
          <TextField
            label={t("targetOrActorId")}
            value={targetText}
            onChangeText={setTargetText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => setTarget(targetText.trim().slice(0, 100))}
          />
          <View style={styles.buttons}>
            <Button
              label={tc("filter")}
              onPress={() => setTarget(targetText.trim().slice(0, 100))}
              style={styles.flex}
            />
            {action || target ? (
              <Button
                variant="ghost"
                label={tc("clear")}
                onPress={() => {
                  setAction("");
                  setTarget("");
                  setTargetText("");
                }}
              />
            ) : null}
          </View>
        </Card>
        <Sheet
          visible={picking}
          onClose={() => setPicking(false)}
          title={ta("category")}
        >
          <ChoiceList
            label={ta("category")}
            choices={[
              { value: "", label: ta("allActions") },
              ...CATEGORIES.map((c) => ({
                value: `${c}.`,
                label: ta(`categories.${c}`),
              })),
            ]}
            value={action}
            onChange={(v) => {
              setPicking(false);
              setAction(v);
            }}
          />
        </Sheet>

        {query.isError && !query.data ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !query.data ? (
          <Loading inline />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<History size={28} color={colors.slate400} aria-hidden />}
            title={t("empty")}
          />
        ) : (
          <>
            <Text variant="small" tone="muted">
              {ta("showing", { count: entries.length })}
            </Text>
            {groups.map((g) => (
              <DayGroup key={g.day} date={g.date} rows={g.rows} />
            ))}
            {query.hasNextPage ? (
              <Button
                variant="secondary"
                label={ta("older")}
                loading={query.isFetchingNextPage}
                onPress={() => query.fetchNextPage()}
              />
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}

function DayGroup({ date, rows }: { date: string; rows: AuditEntry[] }) {
  const locale = useLocale() === "en" ? "en" : "ja";
  return (
    <View style={styles.group}>
      <View style={styles.dayHead}>
        <Text
          variant="caption"
          weight="semibold"
          accessibilityRole="header"
          style={{ color: colors.slate700 }}
        >
          {formatDate(date, locale)}
        </Text>
      </View>
      {rows.map((r, i) => (
        <AuditRow key={r.id} entry={r} first={i === 0} />
      ))}
    </View>
  );
}

function AuditRow({ entry: r, first }: { entry: AuditEntry; first: boolean }) {
  const t = useTranslations("adminMembers.auditLog");
  const locale = useLocale() === "en" ? "en" : "ja";
  const [open, setOpen] = useState(false);
  const targetHref = r.target?.path ? hrefFor(r.target.path) : null;
  return (
    <View style={[styles.row, first ? null : styles.rowBorder]}>
      <View style={styles.rowHead}>
        <Text variant="caption" tone="subtle" style={styles.time}>
          {formatTime(r.createdAt, locale)}
        </Text>
        <View style={styles.flex}>
          <Text variant="small" weight="medium">
            {r.label ?? r.action}
          </Text>
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: colors.slate400, fontFamily: font.mono }}
          >
            {r.action}
          </Text>
        </View>
      </View>
      <View style={styles.line}>
        <Text variant="caption" tone="subtle">
          {t("actor")}:{" "}
        </Text>
        {r.actor ? (
          <PersonLink
            label={r.actor.label}
            path={`/app/admin/members/${r.actor.id}`}
          />
        ) : (
          <Text variant="small" tone="subtle">
            {t("system")}
          </Text>
        )}
      </View>
      {r.target ? (
        <View style={styles.line}>
          <Text variant="caption" tone="subtle">
            {t("target")}:{" "}
          </Text>
          {r.target.typeLabel ? (
            <Text variant="caption" tone="subtle">
              {r.target.typeLabel}{" "}
            </Text>
          ) : null}
          {r.target.person ? (
            <PersonLink label={r.target.person} path={r.target.path} />
          ) : (
            <PersonLink
              label={r.target.id}
              path={targetHref ? r.target.path : null}
              mono
            />
          )}
          {r.applicant ? (
            <PersonLink
              label={r.applicant.label}
              path={`/app/admin/members/${r.applicant.id}`}
            />
          ) : null}
        </View>
      ) : null}
      {r.data ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((v) => !v)}
            style={styles.dataToggle}
          >
            <Text variant="caption" tone="brand" weight="semibold">
              {t("data")}
            </Text>
          </Pressable>
          {open ? (
            <View style={styles.data}>
              <Text
                variant="caption"
                selectable
                style={{ fontFamily: font.mono }}
              >
                {r.data}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** A name that opens its admin page when the app has one. */
function PersonLink({
  label,
  path,
  mono = false,
}: {
  label: string;
  path: string | null;
  mono?: boolean;
}) {
  const router = useRouter();
  const href = path ? hrefFor(path) : null;
  const style = mono ? { fontFamily: font.mono } : undefined;
  if (!href)
    return (
      <Text variant="small" numberOfLines={1} selectable style={style}>
        {label}
      </Text>
    );
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      hitSlop={8}
    >
      <Text variant="small" tone="brand" numberOfLines={1} style={style}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { gap: space.md },
  buttons: { flexDirection: "row", gap: space.sm },
  group: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  dayHead: {
    backgroundColor: colors.slate100,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  row: { padding: space.md, gap: space.xs },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate100,
  },
  rowHead: { flexDirection: "row", gap: space.md },
  time: { width: 48, paddingTop: 2, fontVariant: ["tabular-nums"] },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.xs,
    paddingLeft: 48 + space.md,
  },
  dataToggle: {
    minHeight: TOUCH,
    justifyContent: "center",
    paddingLeft: 48 + space.md,
    alignSelf: "flex-start",
  },
  data: {
    marginLeft: 48 + space.md,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.slate50,
  },
});
