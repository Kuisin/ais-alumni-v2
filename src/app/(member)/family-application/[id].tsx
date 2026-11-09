import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useApplicationThread } from "@/features/application-messages/api";
import { ApplicationThreadCard } from "@/features/application-messages/thread-card";
import { QueryState, Screen } from "@/ui";

/**
 * 「申請についての質問」 (家族 → a child account I manage): the committee's
 * messages about the child's application and my replies — the child has no
 * sign-in of their own. Notifications about it open here
 * (/app/family/application/[id]).
 */
export default function FamilyApplicationScreen() {
  const t = useTranslations("mobile.applicationMessages");
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApplicationThread(id);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  return (
    <>
      <Stack.Screen options={{ title: t("familyRow") }} />
      <QueryState query={query}>
        {(thread) => (
          <Screen refreshing={refreshing} onRefresh={onRefresh}>
            <ApplicationThreadCard thread={thread} />
          </Screen>
        )}
      </QueryState>
    </>
  );
}
