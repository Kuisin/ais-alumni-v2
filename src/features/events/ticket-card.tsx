import type { EventTicket } from "@contract/events";
import { CircleCheck, Ticket } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Card, colors, radius, space, Text } from "@/ui";

const QR_SIZE = 208;

/**
 * The member's QR ticket for the event (the website's TicketCard); staff
 * scan it at the reception. The QR code is made on the server.
 */
export function TicketCard({ ticket }: { ticket: EventTicket }) {
  const t = useTranslations("events.ticket");
  const { locale } = useAuth();
  return (
    <Card style={styles.card}>
      <View style={styles.heading}>
        <Ticket size={20} color={colors.brand700} aria-hidden />
        <Text variant="subheading" accessibilityRole="header">
          {t("title")}
        </Text>
      </View>
      {ticket.checkedInAt ? (
        <View style={styles.checkedIn}>
          <CircleCheck size={20} color={colors.green700} aria-hidden />
          <Text variant="small" weight="medium" style={styles.checkedInText}>
            {t("checkedIn", {
              time: formatDateTime(ticket.checkedInAt, locale),
            })}
          </Text>
        </View>
      ) : null}
      <View style={styles.body}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t("qrAlt", { name: ticket.name })}
          style={styles.qr}
        >
          <SvgXml xml={ticket.qrSvg} width={QR_SIZE} height={QR_SIZE} />
        </View>
        <View style={styles.names}>
          <Text variant="subheading" center>
            {ticket.name}
          </Text>
          {ticket.kanji ? (
            <Text variant="small" tone="muted" center>
              {ticket.kanji}
            </Text>
          ) : null}
        </View>
        <Text variant="small" tone="muted" center>
          {t("hint")}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  heading: { flexDirection: "row", alignItems: "center", gap: space.sm },
  checkedIn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.green50,
    borderRadius: radius.md,
    padding: space.md,
  },
  checkedInText: { flex: 1, color: colors.green700 },
  body: { alignItems: "center", gap: space.md },
  qr: {
    padding: space.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  names: { alignItems: "center", gap: 2 },
});
