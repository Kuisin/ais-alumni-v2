import type { HomeNews } from "@contract/home";
import { Calendar, ChevronRight } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Badge, Card, colors, space, Text } from "@/ui";
import { FallbackTag, SenderTag, UnreadBadge } from "./parts";

/** What a card shows: Home's posts, and the list's (with excerpt / admin view). */
export type NewsCardPost = HomeNews & {
  excerpt?: string | null;
  adminView?: boolean;
};

/** One post in lists (the website's NewsCard). */
export function NewsCard({
  post,
  onPress,
}: {
  post: NewsCardPost;
  onPress: () => void;
}) {
  const t = useTranslations("news");
  const ts = useTranslations("news.sender");
  const { locale } = useAuth();
  const title = post.title || t("untitled");
  const date = post.publishedAt ? formatDate(post.publishedAt, locale) : null;
  const label = [
    post.unread ? t("unread") : null,
    post.adminView ? t("adminView.badge") : null,
    post.needsAnswer ? t("hub.needsAnswer") : null,
    post.pinned ? t("pinned") : null,
    title,
    date,
    post.sender ? ts("from", { role: post.sender }) : null,
  ]
    .filter(Boolean)
    .join(locale === "ja" ? "、" : ", ");

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={label}
      style={post.unread ? { ...styles.card, ...styles.unread } : styles.card}
    >
      <View style={styles.body}>
        <View style={styles.meta}>
          {post.unread ? <UnreadBadge /> : null}
          {post.adminView ? (
            <Badge tone="slate" label={t("adminView.badge")} />
          ) : null}
          {post.needsAnswer ? (
            <Badge tone="amber" label={t("hub.needsAnswer")} />
          ) : null}
          {post.pinned ? <Badge tone="brand" label={t("pinned")} /> : null}
          {date ? (
            <View style={styles.inline}>
              <Calendar size={16} color={colors.slate600} aria-hidden />
              <Text variant="small" tone="muted">
                {date}
              </Text>
            </View>
          ) : null}
          <SenderTag sender={post.sender} />
        </View>
        <Text variant="body" weight={post.unread ? "bold" : "semibold"}>
          {title}
          <FallbackTag fallback={post.titleFallback} />
        </Text>
        {post.excerpt ? (
          <Text variant="small" tone="muted" numberOfLines={2}>
            {post.excerpt}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={20} color={colors.slate400} aria-hidden />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: space.md },
  unread: { borderColor: colors.brand200, borderWidth: 1.5 },
  body: { flex: 1, gap: space.xs },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: space.sm,
    rowGap: space.xs,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
});
