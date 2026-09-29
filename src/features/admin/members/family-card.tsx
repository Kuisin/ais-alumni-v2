import type {
  AdminFamilyLink,
  AdminFamilyResult,
  AdminMemberDetail,
} from "@contract/admin-members";
import { useRouter } from "expo-router";
import { Check, HeartHandshake, Trash2, UserPlus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { confirmAction } from "@/features/me/confirm";
import { Chips } from "@/features/people/choices";
import {
  Badge,
  Button,
  colors,
  radius,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";
import { AdminCard, FailedNotice, Notice } from "../parts";
import {
  useAddFamily,
  useConfirmFamily,
  useFamilyCandidates,
  useRemoveFamily,
} from "./api";

/**
 * 家族 (the website's AdminFamilyPanel): the member's parent / child links —
 * confirm pending ones, remove any — others in the same family, and linking
 * a parent or child found by name (confirmed at once).
 */
export function FamilyCard({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers.family");
  const tc = useTranslations("common");
  const router = useRouter();
  const [result, setResult] = useState<AdminFamilyResult | null>(null);
  const confirm = useConfirmFamily(m.id);
  const remove = useRemoveFamily(m.id);
  const add = useAddFamily(m.id);
  const pending = confirm.isPending || remove.isPending || add.isPending;
  const error = confirm.error ?? remove.error ?? add.error;

  const open = (id: string) =>
    router.push({ pathname: "/admin/members/[id]", params: { id } });
  const run = async (p: Promise<AdminFamilyResult>) =>
    setResult(await p.catch(() => null));

  const onRemove = async (l: AdminFamilyLink) => {
    const ok = await confirmAction({
      title: t("removeLabel", { name: l.other?.name ?? l.childName ?? "—" }),
      message: l.confirmed ? t("removeConfirmed") : t("removePending"),
      confirm: t("remove"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) await run(remove.mutateAsync(l.id));
  };

  const { links, relatives } = m.family;
  return (
    <AdminCard title={t("title")} icon={HeartHandshake}>
      {links.length ? (
        <View style={styles.list}>
          {links.map((l, i) => (
            <View key={l.id} style={[styles.link, i > 0 ? styles.sep : null]}>
              <View style={styles.linkTop}>
                <Badge label={t(`as.${l.as}`)} />
                <Badge
                  tone={l.confirmed ? "green" : "amber"}
                  label={l.confirmed ? t("confirmed") : t("pending")}
                />
              </View>
              {l.other ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => l.other && open(l.other.id)}
                  style={styles.nameLink}
                >
                  <Text weight="medium" tone="brand">
                    {l.other.name}
                  </Text>
                  {l.other.otherName ? (
                    <Text variant="caption" tone="subtle">
                      {l.other.otherName}
                    </Text>
                  ) : null}
                </Pressable>
              ) : (
                <Text weight="medium">
                  {l.childName ?? "—"}{" "}
                  <Text variant="caption" tone="subtle">
                    {t("noAccount")}
                  </Text>
                </Text>
              )}
              <View style={styles.row}>
                {!l.confirmed && l.other ? (
                  <Button
                    label={t("confirm")}
                    variant="secondary"
                    compact
                    disabled={pending}
                    icon={(c) => <Check size={16} color={c} aria-hidden />}
                    onPress={() => run(confirm.mutateAsync(l.id))}
                  />
                ) : null}
                <Button
                  label={t("remove")}
                  variant="ghost"
                  compact
                  disabled={pending}
                  accessibilityLabel={t("removeLabel", {
                    name: l.other?.name ?? l.childName ?? "—",
                  })}
                  icon={(c) => <Trash2 size={16} color={c} aria-hidden />}
                  onPress={() => onRemove(l)}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text variant="small" tone="muted">
          {t("none")}
        </Text>
      )}
      {relatives.length ? (
        <Text variant="small" tone="muted">
          {t("relatives")}
          {relatives.map((r, i) => (
            <Text
              key={r.id}
              variant="small"
              tone="brand"
              accessibilityRole="link"
              onPress={() => open(r.id)}
            >
              {i ? "、" : ""}
              {r.name}
            </Text>
          ))}
        </Text>
      ) : null}
      <AddFamily
        memberId={m.id}
        linked={new Set(links.map((l) => l.other?.id ?? ""))}
        busy={pending}
        onAdd={(otherId, as) => run(add.mutateAsync({ otherId, as }))}
        added={result?.ok ? result : null}
      />
      {result ? (
        <Notice
          tone={result.ok ? "success" : "error"}
          text={t(result.message ?? "errors.notFound")}
        />
      ) : null}
      <FailedNotice error={error} />
    </AdminCard>
  );
}

function AddFamily({
  memberId,
  linked,
  busy,
  onAdd,
  added,
}: {
  memberId: string;
  linked: Set<string>;
  busy: boolean;
  onAdd: (otherId: string, as: "parent" | "child") => void;
  added: AdminFamilyResult | null;
}) {
  const t = useTranslations("adminMembers.family");
  const [as, setAs] = useState<"parent" | "child">("child");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  // Search as you type, a moment after the last key.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(q), 250);
    return () => clearTimeout(timer);
  }, [q]);
  // Linked: start over.
  useEffect(() => {
    if (added) setQ("");
  }, [added]);
  const found = useFamilyCandidates(memberId, as, term);
  const fresh = term.trim()
    ? (found.data?.filter((r) => !linked.has(r.id)) ?? null)
    : null;

  return (
    <View style={styles.add}>
      <Text variant="small" weight="semibold">
        {t("add")}
      </Text>
      <Chips
        label={t("addAs")}
        choices={[
          { value: "child", label: t("addChild") },
          { value: "parent", label: t("addParent") },
        ]}
        value={as}
        onChange={(v) => setAs(v === "parent" ? "parent" : "child")}
      />
      <TextField
        accessibilityLabel={t("search")}
        placeholder={t("search")}
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      <Text variant="caption" tone="subtle">
        {t("addHint")}
      </Text>
      {fresh && fresh.length === 0 && !found.isFetching ? (
        <Text variant="small" tone="muted">
          {t("noResults")}
        </Text>
      ) : null}
      {fresh?.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          accessibilityLabel={t("addLabel", {
            name: r.name,
            as: t(`as.${as}`),
          })}
          disabled={busy}
          onPress={() => onAdd(r.id, as)}
          style={({ pressed }) => [
            styles.candidate,
            pressed ? styles.pressed : null,
          ]}
        >
          <UserPlus size={16} color={colors.brand700} aria-hidden />
          <Text variant="small" style={styles.flex}>
            {r.name}
            {r.other ? (
              <Text variant="small" tone="muted">
                {"  "}
                {r.other}
              </Text>
            ) : null}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  link: { gap: space.xs, padding: space.md },
  sep: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  linkTop: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  nameLink: {
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  add: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
  },
  candidate: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  pressed: { backgroundColor: colors.brand50 },
  flex: { flex: 1 },
});
