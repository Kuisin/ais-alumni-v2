import type { AdminMemberDetail } from "@contract/admin-members";
import { type Href, useRouter } from "expo-router";
import { History } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ADMIN_NAV } from "@/features/admin/nav";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Button, colors, space, Text } from "@/ui";
import { AdminCard } from "../parts";

/** 操作履歴: the latest entries by or about the member (the website's AuditList). */
export function AuditCard({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers");
  const { locale } = useAuth();
  const router = useRouter();
  // The full log, once its screen is in the app (管理 → 操作ログ).
  const auditHref = ADMIN_NAV.find(
    (i) => i.webPath === "/app/admin/audit",
  )?.href;
  return (
    <AdminCard title={t("audit.title")} icon={History}>
      {m.audit.length === 0 ? (
        <Text variant="small" tone="muted">
          {t("auditLog.empty")}
        </Text>
      ) : (
        m.audit.map((a, i) => (
          <View key={a.id} style={[styles.row, i > 0 ? styles.sep : null]}>
            <Text variant="caption" tone="subtle">
              {formatDateTime(a.createdAt, locale)}
            </Text>
            <Text variant="small" weight="medium">
              {a.label}
            </Text>
            {a.label !== a.action ? (
              <Text variant="caption" tone="subtle">
                {a.action}
              </Text>
            ) : null}
            <Text variant="small" tone="muted">
              {t("auditLog.actor")}: {a.actor ?? t("auditLog.system")}
            </Text>
            {a.target ? (
              <Text variant="small" tone="muted">
                {t("auditLog.target")}:{" "}
                {a.targetUserId && a.targetUserId !== m.id ? (
                  <Text
                    variant="small"
                    tone="brand"
                    accessibilityRole="link"
                    onPress={() =>
                      a.targetUserId &&
                      router.push({
                        pathname: "/admin/members/[id]",
                        params: { id: a.targetUserId },
                      })
                    }
                  >
                    {a.target}
                  </Text>
                ) : (
                  a.target
                )}
              </Text>
            ) : null}
          </View>
        ))
      )}
      {auditHref ? (
        <Button
          label={t("audit.viewAll")}
          variant="ghost"
          compact
          style={styles.more}
          onPress={() =>
            router.push(`${String(auditHref)}?target=${m.id}` as Href)
          }
        />
      ) : null}
    </AdminCard>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2, paddingVertical: space.sm },
  more: { alignSelf: "flex-start" },
  sep: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
