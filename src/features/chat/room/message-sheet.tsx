import { type ReactNode, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space, Text, TOUCH } from "@/ui";
import { SheetPlacement, sheetWidth } from "@/ui/fold";
import { PageSheetFrame, useKeptWhileVisible } from "@/ui/sheet";

export type SheetAction = {
  key: string;
  label: string;
  icon: (color: string) => ReactNode;
  destructive?: boolean;
  onPress: () => void;
};

type MessageSheetProps = {
  visible: boolean;
  title: string;
  preview: string;
  actions: SheetAction[];
  cancelLabel: string;
  onClose: () => void;
  top?: ReactNode;
  content?: ReactNode;
};

/**
 * The actions for a long-pressed message (コピー / 削除) — the website shows
 * the same two under the bubble. `top`: above them (the quick reactions);
 * `content`: in place of the preview and actions (the emoji picker), in the
 * same sheet. iOS: the system's page sheet (swipe down or 閉じる to close);
 * Android and the web: a bottom sheet over the talk, off the fold.
 */
export function MessageSheet(props: MessageSheetProps) {
  return Platform.OS === "ios" ? (
    <MessagePageSheet {...props} />
  ) : (
    <MessageBottomSheet {...props} />
  );
}

function ActionRows({ actions }: { actions: SheetAction[] }) {
  return actions.map((a) => {
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
  });
}

function MessagePageSheet({
  visible,
  title,
  preview,
  actions,
  onClose,
  top,
  content,
}: MessageSheetProps) {
  // What it showed, while it slides away after the talk cleared it.
  const shown = {
    title: useKeptWhileVisible(visible, title),
    preview: useKeptWhileVisible(visible, preview),
    actions: useKeptWhileVisible(visible, actions),
    top: useKeptWhileVisible(visible, top),
    content: useKeptWhileVisible(visible, content),
  };
  // An action runs once the sheet is gone: its alert (削除's confirmation)
  // can't open over a sheet that is closing.
  const [pending, setPending] = useState<(() => void) | null>(null);
  const deferred = shown.actions.map((a) => ({
    ...a,
    onPress: () => {
      setPending(() => a.onPress);
      onClose();
    },
  }));
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
      onDismiss={() => {
        const run = pending;
        setPending(null);
        run?.();
      }}
    >
      <PageSheetFrame title={shown.title} onClose={onClose}>
        {shown.content ? (
          <KeyboardAvoidingView style={styles.flex} behavior="padding">
            <View style={styles.pageContent}>{shown.content}</View>
          </KeyboardAvoidingView>
        ) : (
          <ScrollView contentContainerStyle={styles.pageBody}>
            {shown.preview ? (
              <Text
                variant="small"
                tone="subtle"
                numberOfLines={4}
                style={styles.pagePreview}
              >
                {shown.preview}
              </Text>
            ) : null}
            {shown.top}
            <ActionRows actions={deferred} />
          </ScrollView>
        )}
      </PageSheetFrame>
    </Modal>
  );
}

function MessageBottomSheet({
  visible,
  title,
  preview,
  actions,
  cancelLabel,
  onClose,
  top,
  content,
}: MessageSheetProps) {
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
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <SheetPlacement>
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
            accessibilityViewIsModal
          >
            {content ?? (
              <>
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
                {top}
                <ActionRows actions={actions} />
              </>
            )}
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
        </SheetPlacement>
      </KeyboardAvoidingView>
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
    ...sheetWidth,
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
  pageBody: {
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.lg,
    gap: space.xs,
  },
  pagePreview: { paddingHorizontal: space.md, paddingBottom: space.sm },
  pageContent: { flex: 1, paddingHorizontal: space.sm },
});
