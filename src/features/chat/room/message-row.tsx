import type { ChatMessage } from "@contract/chat";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, colors, space, Text } from "@/ui";
import { MemberTags } from "../member-tags";
import { splitMentions } from "../mentions";

export type RoomItem =
  | { kind: "day"; key: string; label: string }
  | { kind: "divider"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      m: ChatMessage;
      mine: boolean;
      /** first of a run from the same sender (avatar, name) */
      runStart: boolean;
      /** 「既読」/「既読 N」 under own messages, or null */
      readLabel: string | null;
      time: string;
      /** names to highlight as @mentions */
      mentionLabels: string[];
    };

/** A date pill, the unread line, or one message bubble (LINE-style). */
export const RoomRow = memo(function RoomRow({
  item,
  direct,
  deletedLabel,
  actionsHint,
  onLongPress,
}: {
  item: RoomItem;
  direct: boolean;
  deletedLabel: string;
  actionsHint: string;
  onLongPress: (m: ChatMessage) => void;
}) {
  if (item.kind === "day")
    return (
      <View style={styles.center} accessibilityRole="header">
        <View style={styles.dayPill}>
          <Text variant="caption" weight="medium" tone="muted">
            {item.label}
          </Text>
        </View>
      </View>
    );
  if (item.kind === "divider")
    return (
      <View style={styles.center}>
        <View style={styles.dividerPill}>
          <Text variant="caption" weight="semibold" style={styles.dividerText}>
            {item.label}
          </Text>
        </View>
      </View>
    );

  const { m, mine, runStart, readLabel, time } = item;
  const parts = m.deleted ? [] : splitMentions(m.body, item.mentionLabels);
  const a11y = [
    mine ? null : m.name,
    m.deleted ? deletedLabel : m.body,
    time,
    readLabel,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View
      style={[
        styles.row,
        mine ? styles.rowMine : null,
        runStart ? styles.runStart : null,
      ]}
    >
      {!mine ? (
        runStart ? (
          <Avatar uri={m.avatar} size={36} />
        ) : (
          <View style={styles.avatarSpace} />
        )
      ) : null}
      <View style={[styles.column, mine ? styles.columnMine : null]}>
        {!mine && runStart && !direct ? (
          <View style={styles.sender}>
            <Text variant="caption" weight="medium" tone="muted">
              {m.name}
            </Text>
            <MemberTags cohort={m.cohort} rep={m.rep} />
          </View>
        ) : null}
        <View style={[styles.line, mine ? styles.lineMine : null]}>
          {m.deleted ? (
            <View style={styles.deleted} accessible accessibilityLabel={a11y}>
              <Text variant="small" tone="subtle" style={styles.italic}>
                {deletedLabel}
              </Text>
            </View>
          ) : (
            <Pressable
              onLongPress={() => onLongPress(m)}
              delayLongPress={350}
              accessibilityLabel={a11y}
              accessibilityHint={actionsHint}
              accessibilityActions={[{ name: "longpress" }]}
              onAccessibilityAction={() => onLongPress(m)}
              style={({ pressed }) => [
                styles.bubble,
                mine ? styles.bubbleMine : styles.bubbleOther,
                runStart ? (mine ? styles.tailMine : styles.tailOther) : null,
                pressed ? (mine ? styles.pressedMine : styles.pressed) : null,
              ]}
            >
              <Text style={[styles.body, mine ? styles.bodyMine : null]}>
                {parts.map((p, i) =>
                  p.mention ? (
                    <Text
                      // biome-ignore lint/suspicious/noArrayIndexKey: parts of one message
                      key={i}
                      weight="bold"
                      style={mine ? styles.mentionMine : styles.mention}
                    >
                      {p.text}
                    </Text>
                  ) : (
                    p.text
                  ),
                )}
              </Text>
            </Pressable>
          )}
          <View
            style={[styles.meta, mine ? styles.metaMine : null]}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            {readLabel ? (
              <Text style={styles.metaText}>{readLabel}</Text>
            ) : null}
            <Text style={[styles.metaText, styles.nums]}>{time}</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: "center", paddingVertical: space.sm },
  dayPill: {
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    backgroundColor: colors.slate200,
  },
  dividerPill: {
    borderRadius: 999,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: colors.red100,
  },
  dividerText: { color: colors.red700 },
  row: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: 2,
    paddingBottom: 2,
  },
  rowMine: { justifyContent: "flex-end" },
  runStart: { paddingTop: space.sm },
  avatarSpace: { width: 36 },
  column: { maxWidth: "78%", minWidth: 0, alignItems: "flex-start" },
  columnMine: { alignItems: "flex-end" },
  sender: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  line: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  lineMine: { flexDirection: "row-reverse" },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 1,
  },
  bubbleMine: { backgroundColor: colors.brand700 },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slate200,
  },
  tailMine: { borderTopRightRadius: 6 },
  tailOther: { borderTopLeftRadius: 6 },
  pressed: { backgroundColor: colors.slate100 },
  pressedMine: { backgroundColor: colors.brand800 },
  body: { fontSize: 15, lineHeight: 22, color: colors.slate900 },
  bodyMine: { color: colors.white },
  mention: { color: colors.brand700 },
  mentionMine: { color: colors.white, textDecorationLine: "underline" },
  deleted: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.slate300,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  italic: { fontStyle: "italic" },
  meta: { paddingBottom: 2, alignItems: "flex-start" },
  metaMine: { alignItems: "flex-end" },
  metaText: { fontSize: 10, lineHeight: 13, color: colors.slate500 },
  nums: { fontVariant: ["tabular-nums"] },
});
