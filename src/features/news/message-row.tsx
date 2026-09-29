import type { MessageSummary } from "@contract/news";
import { Calendar, ChevronRight, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Card, colors, space, Text } from "@/ui";
import { UnreadBadge } from "./parts";

/** One message in あなた宛ての連絡 (the website's MessageRow). */
export function MessageRow({
  message,
  onPress,
}: {
  message: MessageSummary;
  onPress: () => void;
}) {
  const t = useTranslations("news");
  const { locale } = useAuth();
  const date = formatDate(message.sentAt, locale);
  const label = [
    message.unread ? t("unread") : null,
    date,
    message.title,
    message.edited ? t("messages.edited") : null,
    message.sender,
  ]
    .filter(Boolean)
    .join(locale === "ja" ? "、" : ", ");
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={label}
      style={message.unread ? styles.unread : undefined}
    >
      <View style={styles.row}>
        <View style={styles.body}>
          <View style={styles.meta}>
            {message.unread ? <UnreadBadge /> : null}
            <Calendar size={14} color={colors.slate500} aria-hidden />
            <Text variant="small" tone="muted">
              {date}
            </Text>
          </View>
          <Text weight={message.unread ? "bold" : "semibold"}>
            {message.title}
            {message.edited ? (
              <Text variant="caption" tone="subtle">
                {`  ${t("messages.edited")}`}
              </Text>
            ) : null}
          </Text>
          <View style={styles.meta}>
            <UserRound size={14} color={colors.slate500} aria-hidden />
            <Text
              variant="small"
              tone="muted"
              numberOfLines={1}
              style={styles.body}
            >
              {message.sender}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color={colors.slate400} aria-hidden />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  body: { flex: 1, gap: space.xs },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs },
  unread: { borderColor: colors.brand200, borderWidth: 1 },
});
