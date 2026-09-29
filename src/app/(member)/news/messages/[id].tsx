import { Stack, useLocalSearchParams } from "expo-router";
import { Calendar, UserRound, Users } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Notice } from "@/features/events/parts";
import { useMessage } from "@/features/news/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Card, colors, QueryState, Screen, space, Text } from "@/ui";

/**
 * One message for the member (the website's /app/news/messages/[id]):
 * from, when, to whom, and the plain-text body. Opening it records the
 * read. The sender or an admin sees a note that they aren't a recipient.
 */
export default function MessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations("news");
  const { locale } = useAuth();
  const query = useMessage(id);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  return (
    <>
      <Stack.Screen
        options={{ title: query.data?.title ?? t("messages.title") }}
      />
      <QueryState query={query}>
        {(m) => (
          <Screen refreshing={refreshing} onRefresh={refresh}>
            <View style={styles.head}>
              <Text variant="heading" accessibilityRole="header" selectable>
                {m.title}
              </Text>
              <Meta
                icon={<UserRound size={16} color={colors.slate500} />}
                label={t("messages.from")}
              >
                {m.sender}
              </Meta>
              <Meta
                icon={<Calendar size={16} color={colors.slate500} />}
                label={t("messages.sentAt")}
              >
                {formatDateTime(m.sentAt, locale)}
                {m.edited ? `（${t("messages.edited")}）` : ""}
              </Meta>
              <Meta
                icon={<Users size={16} color={colors.slate500} />}
                label={t("messages.sentTo")}
              >
                {m.sentTo}
              </Meta>
            </View>
            {m.isRecipient ? null : (
              <Notice tone="info">{t("messages.senderView")}</Notice>
            )}
            <Card>
              <Text selectable style={styles.body}>
                {m.body}
              </Text>
            </Card>
          </Screen>
        )}
      </QueryState>
    </>
  );
}

function Meta({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.meta} accessible>
      <View aria-hidden>{icon}</View>
      <Text variant="small" weight="medium" tone="subtle">
        {label}
      </Text>
      <Text variant="small" tone="muted" style={styles.flex}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm },
  meta: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
  body: { lineHeight: 26 },
});
