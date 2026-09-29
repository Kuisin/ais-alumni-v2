import type { AdminMemberDetail } from "@contract/admin-members";
import { Briefcase } from "lucide-react-native";
import { useTranslations } from "use-intl";
import { useHistoryEditor } from "@/features/profile/api";
import { HistoryEditorView } from "@/features/profile/history";
import { ErrorState, Loading } from "@/ui";
import { AdminCard } from "../parts";

/**
 * 学歴・職歴: the member's entries, edited by the admin on their behalf
 * (the website's <HistoryEditor userId admin />; saves are audited).
 */
export function HistoryCard({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers.history");
  const history = useHistoryEditor(m.id);
  return (
    <AdminCard title={t("title")} icon={Briefcase} description={t("intro")}>
      {history.data ? (
        <HistoryEditorView data={history.data} userId={m.id} />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : (
        <Loading inline />
      )}
    </AdminCard>
  );
}
