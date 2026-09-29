import { X } from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { colors, radius, space, Text, TOUCH } from "@/ui";

/**
 * A bottom sheet (menus, confirmations, filters): slides up over a dimmed
 * screen; tapping outside, the ✕ or the system back closes it.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const tc = useTranslations("common");
  const insets = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 220,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [visible, slide]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tc("close")}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, space.lg) },
            {
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [320, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <Text
              variant="subheading"
              accessibilityRole="header"
              style={styles.title}
              numberOfLines={2}
            >
              {title ?? ""}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tc("close")}
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [
                styles.close,
                pressed ? styles.pressed : null,
              ]}
            >
              <X size={22} color={colors.slate600} aria-hidden />
            </Pressable>
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: `${colors.slate900}66`,
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingTop: space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.sm,
  },
  title: { flex: 1 },
  close: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.slate100 },
  body: { flexGrow: 0 },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.lg,
  },
});
