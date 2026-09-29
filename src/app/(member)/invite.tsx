import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useInvites } from "@/features/family/api";
import { InviteCreator, SentInvites } from "@/features/family/invite";
import { Card, QueryState, Screen, Text } from "@/ui";

/**
 * 同窓生を招待 (the website's /app/invite): create 個別 / 学年 invitation
 * links, and the ones I've made (with who used them; open ones can be
 * cancelled).
 */
export default function InviteScreen() {
  const t = useTranslations("invites");
  const query = useInvites();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {(page) => (
          <Screen refreshing={refreshing} onRefresh={onRefresh}>
            <Text variant="small" tone="muted">
              {t("description")}
            </Text>
            <Card>
              <InviteCreator cohorts={page.cohorts} />
            </Card>
            {page.invites.length ? (
              <SentInvites invites={page.invites} />
            ) : null}
          </Screen>
        )}
      </QueryState>
    </>
  );
}
