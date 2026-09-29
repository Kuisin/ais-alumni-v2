import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { useAfterCreate } from "@/features/compose/after-save";
import { useComposeOptions } from "@/features/compose/api";
import { EMPTY_EVENT, EventForm } from "@/features/compose/event-form";
import { QueryState, Screen, Text } from "@/ui";

/**
 * 「イベントを作成」 (the website's /app/events/new): the same authors as
 * ニュース. Members see the role the event comes from.
 */
export default function NewEventScreen() {
  const t = useTranslations("events");
  const ts = useTranslations("news.sender");
  const options = useComposeOptions();
  const afterCreate = useAfterCreate("events");
  return (
    <>
      <Stack.Screen options={{ title: t("create") }} />
      <QueryState query={options}>
        {(o) => (
          <Screen>
            <Text tone="muted">{ts("postingAs", { role: o.role })}</Text>
            <EventForm values={EMPTY_EVENT} options={o} onSaved={afterCreate} />
          </Screen>
        )}
      </QueryState>
    </>
  );
}
