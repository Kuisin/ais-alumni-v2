import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./text";
import { space, TOUCH } from "./theme";

/** A titled block on a page, with an optional "more" link. */
export function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text
          variant="subheading"
          accessibilityRole="header"
          style={styles.title}
        >
          {title}
        </Text>
        {action && onAction ? (
          <Pressable
            accessibilityRole="link"
            onPress={onAction}
            style={styles.action}
          >
            <Text variant="small" tone="brand" weight="semibold">
              {action}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { flex: 1 },
  action: { minHeight: TOUCH, justifyContent: "center", paddingLeft: space.sm },
});
