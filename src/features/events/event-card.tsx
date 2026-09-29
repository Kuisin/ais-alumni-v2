import type { EventListItem, RsvpAnswer } from "@contract/events";
import { Calendar, ChevronRight, MapPin, Megaphone } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, colors, space, Text } from "@/ui";
import { FallbackTag } from "./parts";

const ANSWER_TONE: Record<RsvpAnswer, "green" | "amber" | "slate"> = {
  GOING: "green",
  MAYBE: "amber",
  NOT_GOING: "slate",
};

/** One event in the list (the website's EventCard). */
export function EventCard({
  event,
  onPress,
}: {
  event: EventListItem;
  onPress: () => void;
}) {
  const t = useTranslations("events");
  const ts = useTranslations("news.sender");
  const { locale } = useAuth();
  const when = formatDateTime(event.startsAt, locale);
  const title = event.title.text || t("untitled");
  const sender = event.sender ? ts("from", { role: event.sender }) : null;
  const answer = event.myAnswer
    ? t("myAnswer", { answer: t(`answer.${event.myAnswer}`) })
    : null;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[title, when, event.location, sender, answer]
        .filter(Boolean)
        .join(locale === "ja" ? "、" : ", ")}
      style={styles.card}
    >
      <View style={styles.body}>
        <View style={styles.meta}>
          <Calendar size={16} color={colors.slate600} aria-hidden />
          <Text variant="small" tone="muted">
            {when}
          </Text>
        </View>
        <Text variant="body" weight="semibold">
          {title}
          <FallbackTag fallback={event.title.fallback} />
        </Text>
        {event.location || sender || answer ? (
          <View style={styles.tags}>
            {event.location ? (
              <View style={styles.meta}>
                <MapPin size={16} color={colors.slate600} aria-hidden />
                <Text variant="small" tone="muted" style={styles.shrink}>
                  {event.location}
                </Text>
              </View>
            ) : null}
            {sender ? (
              <View style={styles.meta}>
                <Megaphone size={16} color={colors.slate600} aria-hidden />
                <Text variant="small" tone="muted" style={styles.shrink}>
                  {sender}
                </Text>
              </View>
            ) : null}
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
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
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
