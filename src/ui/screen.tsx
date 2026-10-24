import type { ReactNode, Ref } from "react";
import {
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { colors, space } from "./theme";

/**
 * Pages are a column at most this wide, centred: on a wide window (the
 * iPhone Duo's inner display, a desktop browser) lines and cards don't
 * stretch across the whole screen.
 */
export const CONTENT_MAX_WIDTH = 720;

/**
 * Scrolling page body on the slate background, with pull-to-refresh when
 * `onRefresh` is given. Headers come from the navigator (Stack / Tabs).
 */
export function Screen({
  children,
  refreshing = false,
  onRefresh,
  contentStyle,
  ref,
  ...props
}: ScrollViewProps & {
  children: ReactNode;
  /** the ScrollView (scrollTo) */
  ref?: Ref<ScrollView>;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}) {
  return (
    <ScrollView
      ref={ref}
      style={styles.screen}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // iOS: content (e.g. a form's button) can scroll above the keyboard.
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand700}
            colors={[colors.brand700]}
          />
        ) : undefined
      }
      {...props}
    >
      {children}
    </ScrollView>
  );
}

/** Non-scrolling page (lists with their own FlatList, chat …). */
export function ScreenView({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH + 2 * space.lg,
    alignSelf: "center",
    padding: space.lg,
    gap: space.lg,
    paddingBottom: space.xxl,
  },
});
