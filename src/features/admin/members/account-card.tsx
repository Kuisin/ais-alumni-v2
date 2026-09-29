import type { AdminMemberDetail } from "@contract/admin-members";
import { ShieldCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { confirmAction } from "@/features/me/confirm";
import { useAuth } from "@/lib/auth";
import { Button, colors, space, Text } from "@/ui";
import { AdminCard, FailedNotice, ResultNotice } from "../parts";
import { useSetAdmin, useSetState } from "./api";

/**
 * アカウント: stop / restart the account and grant / remove admin rights
 * (the website's MemberStateControl and MemberAdminControl), each after a
 * confirmation.
 */
export function AccountCard({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers");
  return (
    <AdminCard title={t("detail.account")} icon={ShieldCheck}>
      <View style={styles.part}>
        <Text variant="small" weight="semibold">
          {t("status.title")}
        </Text>
        <StateControl m={m} />
      </View>
      <View style={[styles.part, styles.divider]}>
        <Text variant="small" weight="semibold">
          {t("admin.title")}
        </Text>
        <AdminControl m={m} />
      </View>
    </AdminCard>
  );
}

function StateControl({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers.status");
  const tc = useTranslations("common");
  const set = useSetState(m.id);
  if (m.isSelf)
    return (
      <Text variant="small" tone="muted">
        {t("notSelf")}
      </Text>
    );
  const result = (
    <>
      <ResultNotice result={set.data} />
      <FailedNotice error={set.error} />
    </>
  );
  if (m.state === "DEACTIVATED")
    return (
      <View style={styles.part}>
        {result}
        <Button
          label={t("reactivate")}
          variant="secondary"
          loading={set.isPending}
          onPress={() => set.mutate({ state: "ACTIVE" })}
        />
      </View>
    );
  if (m.state !== "ACTIVE")
    return (
      <View style={styles.part}>
        {result}
        <Text variant="small" tone="muted">
          {t("noActions")}
        </Text>
      </View>
    );
  const deactivate = async () => {
    const ok = await confirmAction({
      title: t("deactivate"),
      message: t("deactivateConfirm"),
      confirm: t("deactivate"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) set.mutate({ state: "DEACTIVATED" });
  };
  return (
    <View style={styles.part}>
      {result}
      <Button
        label={t("deactivate")}
        variant="secondary"
        loading={set.isPending}
        onPress={deactivate}
      />
    </View>
  );
}

function AdminControl({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers.admin");
  const tc = useTranslations("common");
  const { refreshMe } = useAuth();
  const set = useSetAdmin(m.id);
  const toggle = async () => {
    const ok = await confirmAction({
      title: m.isAdmin ? t("revoke") : t("grant"),
      message: m.isAdmin
        ? m.isSelf
          ? t("revokeSelfConfirm")
          : t("revokeConfirm")
        : t("grantConfirm"),
      confirm: m.isAdmin ? t("revoke") : t("grant"),
      cancel: tc("cancel"),
      destructive: m.isAdmin,
    });
    if (!ok) return;
    const res = await set.mutateAsync({ grant: !m.isAdmin }).catch(() => null);
    // Removed my own rights: /me no longer allows admin mode, whose
    // layout then leaves it (the website redirects to the dashboard).
    if (res?.ok && m.isSelf && m.isAdmin) await refreshMe();
  };
  return (
    <View style={styles.part}>
      <Text variant="small">{m.isAdmin ? t("isAdmin") : t("notAdmin")}</Text>
      <ResultNotice result={set.data} />
      <FailedNotice error={set.error} />
      {!m.isAdmin && m.state !== "ACTIVE" ? (
        <Text variant="small" tone="muted">
          {t("mustBeActive")}
        </Text>
      ) : (
        <Button
          label={m.isAdmin ? t("revoke") : t("grant")}
          variant="secondary"
          loading={set.isPending}
          onPress={toggle}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  part: { gap: space.sm },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.md,
  },
});
