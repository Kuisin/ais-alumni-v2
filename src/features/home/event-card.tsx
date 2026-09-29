import type { HomeEvent } from "@contract/home";
import { Calendar, ChevronRight, MapPin } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { FallbackTag, SenderTag } from "@/features/news/parts";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, colors, space, Text } from "@/ui";

const ANSWER_TONE = {
  GOING: "green",
  MAYBE: "amber",
  NOT_GOING: "slate",
} as const;

/** An upcoming event on Home (the website's EventCard). */
export function HomeEventCard({
  event,
  onPress,
}: {
  event: HomeEvent;
  onPress: () => void;
}) {
  const t = useTranslations("events");
  const ts = useTranslations("news.sender");
  const { locale } = useAuth();
  const when = formatDateTime(event.startsAt, locale);
  const title = event.title || t("untitled");
  const answer = event.myAnswer
    ? t("myAnswer", { answer: t(`answer.${event.myAnswer}`) })
    : null;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[
        title,
        when,
        event.location,
        event.sender ? ts("from", { role: event.sender }) : null,
        answer,
      ]
        .filter(Boolean)
        .join(locale === "ja" ? "、" : ", ")}
      style={styles.card}
    >
      <View style={styles.body}>
        <View style={styles.inline}>
          <Calendar size={16} color={colors.slate600} aria-hidden />
          <Text variant="small" tone="muted">
            {when}
          </Text>
        </View>
        <Text variant="body" weight="semibold">
          {title}
          <FallbackTag fallback={event.titleFallback} />
        </Text>
        {event.location || event.sender || answer ? (
          <View style={styles.tags}>
            {event.location ? (
              <View style={styles.inline}>
                <MapPin size={16} color={colors.slate600} aria-hidden />
                <Text variant="small" tone="muted" style={styles.shrink}>
                  {event.location}
                </Text>
              </View>
            ) : null}
            <SenderTag sender={event.sender} />
            {answer && event.myAnswer ? (
              <Badge label={answer} tone={ANSWER_TONE[event.myAnswer]} />
            ) : null}
          </View>
        ) : null}
      </View>
      <ChevronRight size={20} color={colors.slate400} aria-hidden />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: space.md },
  body: { flex: 1, gap: space.xs },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: space.md,
    rowGap: space.xs,
    marginTop: 2,
  },
  shrink: { flexShrink: 1 },
});
