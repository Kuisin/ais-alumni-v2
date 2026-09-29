import type { EventDetail } from "@contract/events";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CalendarX } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useEvent } from "@/features/events/api";
import { FactsCard } from "@/features/events/facts-card";
import { FallbackTag } from "@/features/events/parts";
import { RsvpCard } from "@/features/events/rsvp-card";
import { TicketCard } from "@/features/events/ticket-card";
import { isApiError } from "@/lib/api";
import {
  Button,
  Card,
  colors,
  Markdown,
  QueryState,
  Screen,
  space,
  Text,
} from "@/ui";

/**
 * One event (the website's /app/events/[id]): the member's ticket, when /
 * where / capacity / deadline, the RSVP, and the details. Staff open the
 * website's check-in screen.
 */
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations("events");
  const query = useEvent(id);
  const [refreshing, setRefreshing] = useState(false);
  const title = query.data
    ? query.data.title.text || t("untitled")
    : t("title");

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  // Gone, not approved yet, or not for this member: nothing to retry.
  if (!query.data && isApiError(query.error, "not_found"))
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Unavailable />
      </>
    );

  return (
    <>
      <Stack.Screen options={{ title }} />
      <QueryState query={query}>
        {(event) => (
          <Screen refreshing={refreshing} onRefresh={refresh}>
            <Heading event={event} />
            {event.ticket ? <TicketCard ticket={event.ticket} /> : null}
            <FactsCard event={event} />
            {/* Answering comes right after when / where / deadline. */}
            <RsvpCard event={event} />
            {event.body.text ? (
              <Card style={styles.card}>
                <Text variant="subheading" accessibilityRole="header">
                  {t("details")}
                </Text>
                <FallbackTag fallback={event.body.fallback} block />
                <Markdown source={event.body.text} />
              </Card>
            ) : null}
          </Screen>
        )}
      </QueryState>
    </>
  );
}

function Heading({ event }: { event: EventDetail }) {
  const t = useTranslations("events");
  return (
    <View style={styles.heading}>
      <Text variant="heading" accessibilityRole="header" selectable>
        {event.title.text || t("untitled")}
        <FallbackTag fallback={event.title.fallback} />
      </Text>
    </View>
  );
}

function Unavailable() {
  const t = useTranslations("events");
  const router = useRouter();
  return (
    <View style={styles.unavailable}>
      <CalendarX size={40} color={colors.slate400} aria-hidden />
      <Text tone="muted" center>
        {t("rsvp.errors.notFound")}
      </Text>
      <Button
        variant="secondary"
        label={t("backToList")}
        onPress={() => router.dismissTo("/events")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  unavailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: space.xl,
    backgroundColor: colors.background,
  },
  heading: { gap: space.md },
  start: { alignSelf: "flex-start" },
  card: { gap: space.md },
});
