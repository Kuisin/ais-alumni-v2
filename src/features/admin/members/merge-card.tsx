import type {
  AdminMemberDetail,
  AdminMergeResult,
  AdminMergeSide,
} from "@contract/admin-members";
import { useRouter } from "expo-router";
import { Merge } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Chips } from "@/features/people/choices";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
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
import {
  Actions,
  AdminCard,
  Facts,
  FailedNotice,
  ResultNotice,
} from "../parts";
import { useMerge } from "./api";

/**
 * 重複アカウントの統合 (the website's MemberMerge): the other account by ID
 * or email and which one to keep → both shown side by side → merge. A
 * safety check (keeping a parent-managed account) can be bypassed.
 */
export function MergeCard({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers.merge");
  const tc = useTranslations("common");
  const router = useRouter();
  const [other, setOther] = useState("");
  const [keep, setKeep] = useState<"this" | "other">("this");
  const [force, setForce] = useState(false);
  const [state, setState] = useState<AdminMergeResult>({});
  const merge = useMerge(m.id);

  const preview = async () => {
    setForce(false);
    const r = await merge
      .mutateAsync({ intent: "preview", other: other.trim(), keep })
      .catch(() => null);
    if (r) setState(r);
  };
  const confirm = async () => {
    if (!state.preview) return;
    const r = await merge
      .mutateAsync({
        intent: "confirm",
        keepId: state.preview.keep.id,
        duplicateId: state.preview.duplicate.id,
        force,
      })
      .catch(() => null);
    if (!r) return;
    if (r.mergedInto) {
      setState({});
      setOther("");
      // The duplicate is gone: show the kept account (as ?merged=1 does).
      router.replace({
        pathname: "/admin/members/[id]",
        params: { id: r.mergedInto, merged: "1" },
      });
      return;
    }
    setState((s) => ({ ...s, ...r, preview: r.preview ?? s.preview }));
  };

  if (state.preview) {
    const { keep: k, duplicate: d } = state.preview;
    return (
      <AdminCard title={t("title")} icon={Merge}>
        <Text weight="semibold">{t("confirmTitle")}</Text>
        <Side side={k} label={t("keepLabel")} tone="green" />
        <Side side={d} label={t("duplicateLabel")} tone="red" />
        <Text variant="small">{t("whatHappens")}</Text>
        <ResultNotice result={state} />
        <FailedNotice error={merge.error} />
        {state.blocked ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: force }}
            onPress={() => setForce(!force)}
            style={styles.bypass}
          >
            <View style={[styles.box, force ? styles.boxOn : null]}>
              {force ? <Text style={styles.tick}>✓</Text> : null}
            </View>
            <View style={styles.flex}>
              <Text variant="small" weight="medium" style={styles.amber}>
                {t("bypass")}
              </Text>
              <Text variant="small" style={styles.amber}>
                {t(`bypassHint.${state.blocked}`)}
              </Text>
            </View>
          </Pressable>
        ) : null}
        <Actions>
          <Button
            label={merge.isPending ? t("working") : t("confirm")}
            variant="danger"
            loading={merge.isPending}
            onPress={confirm}
          />
          <Button
            label={tc("cancel")}
            variant="secondary"
            onPress={() => setState({})}
          />
        </Actions>
      </AdminCard>
    );
  }

  return (
    <AdminCard title={t("title")} icon={Merge} description={t("description")}>
      <TextField
        label={t("other")}
        hint={t("otherHint")}
        value={other}
        onChangeText={setOther}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Chips
        label={t("keep")}
        choices={[
          { value: "this", label: t("keepThis") },
          { value: "other", label: t("keepOther") },
        ]}
        value={keep}
        onChange={(v) => setKeep(v === "other" ? "other" : "this")}
      />
      <ResultNotice result={state} />
      <FailedNotice error={merge.error} />
      <Actions>
        <Button
          label={merge.isPending ? tc("loading") : t("preview")}
          variant="secondary"
          loading={merge.isPending}
          disabled={!other.trim()}
          onPress={preview}
        />
      </Actions>
    </AdminCard>
  );
}

function Side({
  side,
  label,
  tone,
}: {
  side: AdminMergeSide;
  label: string;
  tone: "green" | "red";
}) {
  const t = useTranslations("adminMembers");
  const tr = useTranslations("roles");
  const { locale } = useAuth();
  return (
    <View style={styles.side}>
      <Badge tone={tone} label={label} />
      <Facts
        rows={[
          [t("columns.name"), side.name],
          [t("columns.email"), side.email],
          [t("columns.state"), tr(`state.${side.state}`)],
          [
            t("columns.roles"),
            side.roles.map((r) => tr(`role.${r}`)).join(", "),
          ],
          [t("detail.providers"), side.providers.join(", ")],
          [t("columns.created"), formatDate(side.createdAt, locale)],
          ["ID", side.id],
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  side: {
    gap: space.sm,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  bypass: {
    minHeight: TOUCH,
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amber400,
    backgroundColor: colors.amber50,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.amber800,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  boxOn: { backgroundColor: colors.amber800 },
  tick: { color: colors.white, fontWeight: "700", lineHeight: 18 },
  amber: { color: colors.amber900 },
  flex: { flex: 1, gap: 2 },
});
