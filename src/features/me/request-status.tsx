import type { ChangeRequest } from "@contract/account";
import { StyleSheet, View } from "react-native";
import { Badge, Button, colors, radius, space, Text } from "@/ui";

/**
 * The latest request to change a locked field (name, birth date, gender),
 * as the website's RequestStatus: pending (with withdraw — done on the
 * website) or the committee's decision with its note.
 */
export function RequestStatus({
  request,
  pendingText,
  statusLabel,
  reviewNoteLabel,
  withdrawLabel,
  onWithdraw,
}: {
  request: ChangeRequest | null;
  /** e.g. 「2026年9月20日（日） に申請しました。…」 */
  pendingText: string;
  statusLabel: (status: ChangeRequest["status"]) => string;
  reviewNoteLabel: string;
  withdrawLabel: string;
  /** Omitted: no withdraw button (the app can't withdraw this one yet). */
  onWithdraw?: () => void;
}) {
  if (!request) return null;
  if (request.status === "PENDING")
    return (
      <View style={styles.pending}>
        <View style={styles.line}>
          <Badge tone="amber" label={statusLabel(request.status)} />
          <Text variant="small" weight="medium" style={styles.pendingText}>
            {pendingText}
          </Text>
        </View>
        {onWithdraw ? (
          <Button
            variant="secondary"
            compact
            hitSlop={4}
            label={withdrawLabel}
            onPress={onWithdraw}
            style={styles.withdraw}
          />
        ) : null}
      </View>
    );
  return (
    <View style={styles.line}>
      <Badge
        tone={request.status === "APPROVED" ? "green" : "red"}
        label={statusLabel(request.status)}
      />
      {request.reviewNote ? (
        <Text variant="small" tone="muted" style={styles.note}>
          {`${reviewNoteLabel}: ${request.reviewNote}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pending: {
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.amber100,
    backgroundColor: colors.amber50,
    borderRadius: radius.md,
    padding: space.md,
  },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  pendingText: { color: colors.amber900, flexShrink: 1 },
  note: { flexShrink: 1 },
  withdraw: { alignSelf: "flex-start" },
});
