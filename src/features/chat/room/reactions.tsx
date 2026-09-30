import type { ChatReactionSummary } from "@contract/chat";
import { Plus } from "lucide-react-native";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, space, Text, TOUCH } from "@/ui";

/** The quick row at the top of a message's sheet. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export type ReactionLabels = {
  /** "{emoji} {count}" */
  chip: (r: ChatReactionSummary) => string;
  hint: string;
  who: string;
};

/**
 * Emoji + count under a bubble, on its side; the member's own highlighted.
 * Tap toggles (when `onToggle`), long press shows who reacted.
 */
export const ReactionChips = memo(function ReactionChips({
  messageId,
  reactions,
  mine,
  labels,
  onToggle,
  onShowNames,
}: {
  messageId: string;
  reactions: ChatReactionSummary[];
  /** the bubble is the member's own (right side) */
  mine: boolean;
  labels: ReactionLabels;
  onToggle?: (messageId: string, emoji: string) => void;
  onShowNames: (r: ChatReactionSummary) => void;
}) {
  return (
    <View style={[styles.chips, mine ? styles.chipsMine : null]}>
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          accessibilityRole="button"
          accessibilityState={{ selected: r.mine, disabled: !onToggle }}
          accessibilityLabel={labels.chip(r)}
          accessibilityHint={labels.hint}
          accessibilityActions={[
            { name: "activate" },
            { name: "longpress", label: labels.who },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "longpress") onShowNames(r);
            else onToggle?.(messageId, r.emoji);
          }}
          onPress={onToggle ? () => onToggle(messageId, r.emoji) : undefined}
          onLongPress={() => onShowNames(r)}
          delayLongPress={350}
          hitSlop={CHIP_SLOP}
          style={({ pressed }) => [
            styles.chip,
            r.mine ? styles.chipOn : null,
            pressed ? (r.mine ? styles.chipOnPressed : styles.pressed) : null,
          ]}
        >
          <Text style={styles.emoji}>{r.emoji}</Text>
          <Text
            variant="caption"
            weight={r.mine ? "bold" : "medium"}
            style={[styles.count, r.mine ? styles.countOn : null]}
          >
            {r.count}
          </Text>
        </Pressable>
      ))}
    </View>
  );
});

const CHIP_HEIGHT = 30;
/** Chips are drawn small; their touch area reaches 44 pt. */
const CHIP_SLOP = {
  top: (TOUCH - CHIP_HEIGHT) / 2,
  bottom: (TOUCH - CHIP_HEIGHT) / 2,
  left: 2,
  right: 2,
};

/** 👍 ❤️ 😂 😮 😢 🙏 and ＋ (the full picker), in a message's sheet. */
export function QuickReactions({
  mineEmoji,
  label,
  addLabel,
  onPick,
  onMore,
}: {
  /** emoji the member already used on this message (shown selected) */
  mineEmoji: readonly string[];
  label: (emoji: string) => string;
  addLabel: string;
  onPick: (emoji: string) => void;
  onMore: () => void;
}) {
  return (
    <View style={styles.quick}>
      {QUICK_REACTIONS.map((emoji) => {
        const on = mineEmoji.includes(emoji);
        return (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label(emoji)}
            onPress={() => onPick(emoji)}
            style={({ pressed }) => [
              styles.quickButton,
              on ? styles.quickOn : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.quickEmoji}>{emoji}</Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        onPress={onMore}
        style={({ pressed }) => [
          styles.quickButton,
          styles.quickMore,
          pressed ? styles.pressed : null,
        ]}
      >
        <Plus size={22} color={colors.slate600} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    justifyContent: "flex-start",
  },
  chipsMine: { justifyContent: "flex-end" },
  chip: {
    height: CHIP_HEIGHT,
    minWidth: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: CHIP_HEIGHT / 2,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  chipOnPressed: { backgroundColor: colors.brand100 },
  pressed: { backgroundColor: colors.slate100 },
  emoji: { fontSize: 15, lineHeight: 20 },
  count: { color: colors.slate600, fontVariant: ["tabular-nums"] },
  countOn: { color: colors.brand700 },
  quick: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: space.xs,
  },
  quickButton: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  quickOn: { backgroundColor: colors.brand50 },
  quickMore: { backgroundColor: colors.slate100 },
  quickEmoji: { fontSize: 26, lineHeight: 32 },
});
