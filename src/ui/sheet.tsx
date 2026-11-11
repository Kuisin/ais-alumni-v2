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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { SheetPlacement, sheetWidth } from "./fold";
import { Text } from "./text";
import { colors, radius, space, TOUCH } from "./theme";

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/**
 * A sheet with content (choices, filters, a form). iOS: the system's page
 * sheet (UISheetPresentationController, placed by iOS — also on the
 * iPhone Duo), dismissed by swiping down or 閉じる. Android and the web: a
 * bottom sheet drawn here, sliding up over a dimmed screen; tapping
 * outside, the ✕ or the system back closes it, and on a folding phone it
 * keeps off the fold (SheetPlacement). Plain menus and confirmations use
 * useActionMenu (./action-menu) instead.
 */
export function Sheet(props: SheetProps) {
  return Platform.OS === "ios" ? (
    <PageSheet {...props} />
  ) : (
    <DrawnSheet {...props} />
  );
}

/**
 * iOS: the content of a system page sheet (a Modal with
 * presentationStyle="pageSheet"): a header with the title and 閉じる, then
 * the children. Exported for sheets with their own body (MessageSheet).
 */
export function PageSheetFrame({
  title,
  onClose,
  closeLabel,
  children,
}: {
  title?: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
}) {
  const tc = useTranslations("common");
  const label = closeLabel ?? tc("close");
  return (
    <SafeAreaView
      edges={["top", "right", "bottom", "left"]}
      style={styles.page}
    >
      <View style={styles.pageHeader}>
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
          accessibilityLabel={label}
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [
            styles.done,
            pressed ? styles.pressedText : null,
          ]}
        >
          <Text weight="semibold" tone="brand">
            {label}
          </Text>
        </Pressable>
      </View>
      {children}
    </SafeAreaView>
  );
}

/**
 * `value` while `visible`, else the last one shown: a system sheet still
 * draws its content while it slides away, after the caller has cleared it.
 * Pass props as they are (not a new object each render).
 */
export function useKeptWhileVisible<T>(visible: boolean, value: T): T {
  const [kept, setKept] = useState(value);
  if (visible && kept !== value) setKept(value);
  return visible ? value : kept;
}

function PageSheet({ visible, onClose, title, children }: SheetProps) {
  const shownTitle = useKeptWhileVisible(visible, title);
  const shownChildren = useKeptWhileVisible(visible, children);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <PageSheetFrame title={shownTitle} onClose={onClose}>
        <KeyboardAvoidingView style={styles.fillOnly} behavior="padding">
          <ScrollView
            style={styles.fillOnly}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {shownChildren}
          </ScrollView>
        </KeyboardAvoidingView>
      </PageSheetFrame>
    </Modal>
  );
}

function DrawnSheet({ visible, onClose, title, children }: SheetProps) {
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
      <KeyboardAvoidingView style={styles.fill}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tc("close")}
        />
        <SheetPlacement>
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
        </SheetPlacement>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  fillOnly: { flex: 1 },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: `${colors.slate900}66`,
  },
  sheet: {
    ...sheetWidth,
    maxHeight: "88%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingTop: space.sm,
  },
  page: { flex: 1, backgroundColor: colors.surface },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingTop: space.sm,
    minHeight: TOUCH + space.sm,
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
  done: {
    minWidth: TOUCH,
    minHeight: TOUCH,
    paddingHorizontal: space.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.slate100 },
  pressedText: { opacity: 0.5 },
  body: { flexGrow: 0 },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.lg,
  },
});
