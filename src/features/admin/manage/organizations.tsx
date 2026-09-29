import type {
  AdminFormResult,
  AdminOrg,
  OrgKind,
} from "@contract/admin-manage";
import { Stack } from "expo-router";
import { Building2, Check, Pencil, School } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Notice, SegmentedTabs } from "@/features/events/parts";
import { confirmAction } from "@/features/me/confirm";
import { Chips } from "@/features/people/choices";
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
  TOUCH,
} from "@/ui";
import {
  adminManageApi,
  type OrgParams,
  useAdminOrgs,
  useRefreshAdmin,
} from "./api";

/** 学校・会社の管理 (the website's /app/admin/organizations). */
export function AdminOrganizationsScreen() {
  const t = useTranslations("organizations");
  const [params, setParams] = useState<OrgParams>({
    kind: "school",
    sort: "name",
    q: "",
  });
  const [text, setText] = useState("");
  const query = useAdminOrgs(params);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  const counts = query.data?.counts;
  const search = () =>
    setParams((p) => ({ ...p, q: text.trim().slice(0, 80) }));

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Text variant="small" tone="muted">
          {t("description")}
        </Text>
        <SegmentedTabs<OrgKind>
          label={t("tabsLabel")}
          items={(["school", "company"] as const).map((k) => ({
            key: k,
            label: counts ? `${t(`tabs.${k}`)} (${counts[k]})` : t(`tabs.${k}`),
          }))}
          value={params.kind}
          onChange={(kind) => setParams((p) => ({ ...p, kind }))}
        />
        <View style={styles.filters} accessibilityLabel={t("filterLabel")}>
          <TextField
            value={text}
            onChangeText={setText}
            placeholder={t("searchPlaceholder")}
            accessibilityLabel={t("search")}
            inputMode="search"
            returnKeyType="search"
            onSubmitEditing={search}
            autoCorrect={false}
          />
          <Button variant="secondary" label={t("search")} onPress={search} />
          <Chips
            label={t("sort.label")}
            choices={[
              { value: "name", label: t("sort.name") },
              { value: "count", label: t("sort.count") },
            ]}
            value={params.sort}
            onChange={(v) =>
              setParams((p) => ({
                ...p,
                sort: v === "count" ? "count" : "name",
              }))
            }
          />
        </View>
        <QueryState query={query}>
          {(data) => (
            <View style={styles.results}>
              <Text
                variant="small"
                tone="muted"
                accessibilityLiveRegion="polite"
              >
                {data.total > data.rows.length
                  ? t("countLimited", {
                      total: data.total,
                      shown: data.rows.length,
                    })
                  : t("count", { total: data.total })}
              </Text>
              {data.rows.length === 0 ? (
                <EmptyState
                  icon={
                    data.kind === "school" ? (
                      <School color={colors.slate400} size={28} aria-hidden />
                    ) : (
                      <Building2
                        color={colors.slate400}
                        size={28}
                        aria-hidden
                      />
                    )
                  }
                  title={t("empty")}
                  hint={data.q ? t("emptySearchHint") : t("emptyHint")}
                />
              ) : (
                <ListGroup>
                  {data.rows.map((r, i) => (
                    <View key={r.id}>
                      {i > 0 ? <Separator /> : null}
                      <OrgRow kind={data.kind} org={r} />
                    </View>
                  ))}
                </ListGroup>
              )}
            </View>
          )}
        </QueryState>
      </Screen>
    </>
  );
}

/** One entry; opens rename, merge and (when unused) delete. */
function OrgRow({ kind, org }: { kind: OrgKind; org: AdminOrg }) {
  const t = useTranslations("organizations");
  const tc = useTranslations("common");
  const refresh = useRefreshAdmin();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    const ok = await confirmAction({
      title: t("deleteConfirm"),
      confirm: t("delete"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await adminManageApi.deleteOrg(kind, org.id);
    } finally {
      setDeleting(false);
      await refresh("organizations");
    }
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${org.name}, ${t("members", { count: org.count })}, ${t("manage")}`}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      >
        <Text weight="medium" style={styles.flex} numberOfLines={2}>
          {org.name}
        </Text>
        <Badge
          label={t("members", { count: org.count })}
          tone={org.count ? "brand" : "slate"}
        />
        <Pencil size={16} color={colors.brand700} aria-hidden />
      </Pressable>
      {open ? (
        <View style={styles.manage}>
          <RenameForm kind={kind} org={org} />
          <Text variant="small" tone="muted">
            {t("mergeHelp")}
          </Text>
          <MergeForm kind={kind} org={org} />
          {org.count === 0 ? (
            <Button
              variant="ghost"
              label={t("delete")}
              loading={deleting}
              onPress={remove}
              style={styles.deleteButton}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Result({ result }: { result: AdminFormResult | null }) {
  const t = useTranslations("organizations");
  if (!result?.message) return null;
  return (
    <Notice tone={result.ok ? "success" : "error"}>{t(result.message)}</Notice>
  );
}

function RenameForm({ kind, org }: { kind: OrgKind; org: AdminOrg }) {
  const t = useTranslations("organizations");
  const refresh = useRefreshAdmin();
  const [name, setName] = useState(org.name);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AdminFormResult | null>(null);
  const save = async () => {
    setSaving(true);
    try {
      const r = await adminManageApi.renameOrg({ kind, id: org.id, name });
      setResult(r);
      if (r.ok) await refresh("organizations");
    } catch {
      setResult({ ok: false, message: "errors.invalid" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.form}>
      <TextField
        label={t("rename")}
        value={name}
        onChangeText={setName}
        maxLength={120}
      />
      <Result result={result} />
      <Button
        variant="secondary"
        label={t("save")}
        loading={saving}
        onPress={save}
      />
    </View>
  );
}

/** Pick the correct entry; this one's members move there and it is removed. */
function MergeForm({ kind, org }: { kind: OrgKind; org: AdminOrg }) {
  const t = useTranslations("organizations");
  const tc = useTranslations("common");
  const refresh = useRefreshAdmin();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<AdminOrg | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AdminFormResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim().slice(0, 80)), 180);
    return () => clearTimeout(timer);
  }, [text]);
  const options = useAdminOrgs({ kind, sort: "name", q }, q.length > 0);
  const found = q
    ? (options.data?.rows ?? []).filter((o) => o.id !== org.id).slice(0, 8)
    : [];

  const merge = async () => {
    if (!target) return setResult({ ok: false, message: "errors.pickTarget" });
    const ok = await confirmAction({
      title: t("mergeConfirm"),
      confirm: t("merge"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const r = await adminManageApi.mergeOrg({
        kind,
        id: org.id,
        targetId: target.id,
      });
      setResult(r);
      if (r.ok) await refresh("organizations");
    } catch {
      setResult({ ok: false, message: "errors.invalid" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <TextField
        label={t("mergeInto")}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setTarget(null);
        }}
        placeholder={t("searchPlaceholder")}
        inputMode="search"
        autoCorrect={false}
      />
      {target ? null : (
        <View style={styles.options}>
          {found.map((o) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={o.name}
              onPress={() => {
                setTarget(o);
                setText(o.name);
              }}
              style={({ pressed }) => [
                styles.option,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text variant="small" style={styles.flex}>
                {o.name}
              </Text>
              <Text variant="caption" tone="subtle">
                {t("members", { count: o.count })}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {target ? (
        <View style={styles.picked}>
          <Check size={16} color={colors.green700} aria-hidden />
          <Text variant="small" weight="medium" style={styles.flex}>
            {target.name}
          </Text>
        </View>
      ) : null}
      <Result result={result} />
      <Button
        variant="danger"
        label={t("merge")}
        loading={saving}
        onPress={merge}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.sm },
  results: { gap: space.md },
  flex: { flex: 1 },
  row: {
    minHeight: TOUCH + 8,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.slate100 },
  manage: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    backgroundColor: colors.surface,
  },
  form: { gap: space.sm },
  options: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.slate50,
  },
  option: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  picked: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.green50,
  },
  deleteButton: { alignSelf: "flex-start" },
});
