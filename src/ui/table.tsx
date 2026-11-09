import { type ReactNode, useState } from "react";
import {
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "./text";
import { colors, radius, space } from "./theme";

export type TableColumn = {
  key: string;
  label: string;
  /** the column's least width; columns share any room left over */
  width: number;
};

export type TableRow = {
  key: string;
  /** one per column: text, or any element */
  cells: ReactNode[];
  /** the reader's own row: tinted, with a bar at the start */
  highlight?: boolean;
  /** what a screen reader says for the row (defaults to its text cells) */
  label?: string;
};

/**
 * A table for reading, not editing: a header row, then rows, with lines
 * between them. Columns keep their least width and share the rest; on a
 * narrow phone the table scrolls sideways (the first column's text says
 * which row it is). Highlighted rows stand out for the reader's own data.
 */
export function Table({
  columns,
  rows,
  caption,
}: {
  columns: TableColumn[];
  rows: TableRow[];
  caption?: string;
}) {
  const [width, setWidth] = useState(0);
  const least = columns.reduce((n, c) => n + c.width, 0);
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);
  const cell = (content: ReactNode, i: number, header = false) => (
    <View
      key={columns[i]?.key ?? i}
      style={[styles.cell, { width: columns[i]?.width, flexGrow: 1 }]}
    >
      {typeof content === "string" ? (
        <Text
          variant="small"
          weight={header || i === 0 ? "semibold" : "regular"}
          tone={header ? "muted" : "default"}
        >
          {content}
        </Text>
      ) : (
        content
      )}
    </View>
  );
  return (
    <View style={styles.frame} onLayout={onLayout}>
      {caption ? (
        <Text variant="caption" tone="subtle" style={styles.caption}>
          {caption}
        </Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={least > width}>
        <View style={{ minWidth: Math.max(least, width) }}>
          <View style={[styles.row, styles.header]} accessibilityRole="header">
            {columns.map((c, i) => cell(c.label, i, true))}
          </View>
          {rows.map((r) => (
            <View
              key={r.key}
              style={[styles.row, r.highlight ? styles.highlight : null]}
              accessible
              accessibilityLabel={
                r.label ??
                r.cells
                  .map((c, i) =>
                    typeof c === "string" ? `${columns[i]?.label}: ${c}` : null,
                  )
                  .filter(Boolean)
                  .join(", ")
              }
            >
              {r.cells.map((c, i) => cell(c, i))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  caption: { paddingHorizontal: space.md, paddingTop: space.sm },
  row: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  header: { backgroundColor: colors.slate50, borderTopWidth: 0 },
  highlight: {
    backgroundColor: colors.brand50,
    borderLeftColor: colors.brand600,
  },
  cell: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    justifyContent: "center",
    gap: 2,
  },
});
