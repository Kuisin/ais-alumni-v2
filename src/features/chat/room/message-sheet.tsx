import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space, Text, TOUCH } from "@/ui";

export type SheetAction = {
  key: string;
  label: string;
  icon: (color: string) => ReactNode;
  destructive?: boolean;
  onPress: () => void;
};

/**
 * The actions for a long-pressed message (コピー / 削除), as a bottom sheet
 * over the talk — the website shows the same two under the bubble.
 */
export function MessageSheet({
  visible,
  title,
  preview,
  actions,
  cancelLabel,
  onClose,
}: {
  visible: boolean;
  title: string;
  preview: string;
  actions: SheetAction[];
  cancelLabel: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
          accessibilityViewIsModal
        >
          <View style={styles.head}>
            <Text variant="small" weight="semibold" numberOfLines={1}>
              {title}
            </Text>
            {preview ? (
              <Text variant="small" tone="subtle" numberOfLines={2}>
                {preview}
              </Text>
            ) : null}
          </View>
          {actions.map((a) => {
            const color = a.destructive ? colors.red700 : colors.slate900;
            return (
              <Pressable
                key={a.key}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                onPress={a.onPress}
                style={({ pressed }) => [
                  styles.action,
                  pressed ? styles.pressed : null,
                ]}
              >
                {a.icon(color)}
                <Text weight="medium" style={{ color }}>
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.action,
              styles.cancel,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text weight="semibold" tone="brand" center style={styles.flex}>
              {cancelLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
  },
  head: {
    gap: 2,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: space.xs,
  },
  action: {
    minHeight: TOUCH + 8,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  cancel: {
    marginTop: space.xs,
    justifyContent: "center",
    backgroundColor: colors.slate100,
  },
  pressed: { backgroundColor: colors.slate100 },
  flex: { flex: 1 },
});
