import type { EventDetail } from "@contract/events";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { MapPin } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, colors, space, Text, TOUCH } from "@/ui";

/** 日時 · 主催 · 場所 · 定員 · 回答期限 (the website's event facts). */
export function FactsCard({ event }: { event: EventDetail }) {
  const t = useTranslations("events");
  const { locale } = useAuth();
  const { rsvp } = event;

  const openMap = (url: string) => {
    // A maps app if one handles the link, else the in-app browser.
    Linking.openURL(url).catch(() => WebBrowser.openBrowserAsync(url));
  };

  return (
    <Card style={styles.card}>
      <Fact label={t("when")}>
        {/* start – end, a line each so a date never breaks in two */}
        <Text>
          {formatDateTime(event.startsAt, locale)}
          {event.endsAt ? ` –\n${formatDateTime(event.endsAt, locale)}` : null}
          <Text tone="subtle">{` ${t("jst")}`}</Text>
        </Text>
      </Fact>
      <Fact label={t("organizer")}>
        <Text>{event.sender}</Text>
      </Fact>
      {event.location || event.mapUrl ? (
        <Fact label={t("where")}>
          {event.location ? <Text selectable>{event.location}</Text> : null}
          {event.mapUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("openMap")}
              onPress={() => event.mapUrl && openMap(event.mapUrl)}
              // 32 pt row + 6 pt above and below: 44 pt to the finger
              hitSlop={6}
              style={({ pressed }) => [
                styles.mapLink,
                pressed ? styles.pressed : null,
              ]}
            >
              <MapPin size={16} color={colors.brand700} aria-hidden />
              <Text variant="small" tone="brand" style={styles.underline}>
                {t("openMap")}
              </Text>
            </Pressable>
          ) : null}
        </Fact>
      ) : null}
      <Fact label={t("capacity")}>
        <Text>
          {event.capacity === null
            ? t("capacityUnlimited", { going: event.going })
            : t("capacityLimited", {
                capacity: event.capacity,
                going: event.going,
                remaining: event.remaining ?? 0,
              })}
        </Text>
      </Fact>
      <Fact label={t("deadline")}>
        <View style={styles.inline}>
          <Text>{formatDateTime(rsvp.closesAt, locale)}</Text>
          {rsvp.left ? (
            <Badge
              tone="amber"
              label={t(`deadlineLeft.${rsvp.left.unit}`, {
                count: rsvp.left.count,
              })}
            />
          ) : null}
        </View>
      </Fact>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fact}>
      <Text variant="small" weight="medium" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  fact: { gap: 2 },
  inline: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: space.sm,
    rowGap: space.xs,
  },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    minHeight: TOUCH - 12,
    paddingRight: space.sm,
  },
  pressed: { opacity: 0.6 },
  underline: { textDecorationLine: "underline" },
});
