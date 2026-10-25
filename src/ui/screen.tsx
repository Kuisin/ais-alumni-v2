import type { ReactNode, Ref } from "react";
import {
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  type ScrollViewProps,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, space } from "./theme";

/**
 * Pages are a column at most this wide, centred: on a wide window (the
 * iPhone Duo's inner display, a desktop browser) lines and cards don't
 * stretch across the whole screen.
 */
export const CONTENT_MAX_WIDTH = 720;

/**
 * Pages keep clear of a bar at the screen's side — on the iPhone Duo, the
 * system's vertical bar (status bar, tab bar, toolbar) at the left or right
 * — as SafeAreaView measures it where the page is. Top and bottom are the
 * navigator's.
 */
const SIDES = ["left", "right"] as const;

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
  ref?: Ref<ScrollViewInstance>;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}) {
  return (
    <ScrollView
      ref={ref}
      style={styles.screen}
      contentContainerStyle={styles.container}
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
      <SafeAreaView edges={SIDES} style={[styles.content, contentStyle]}>
        {children}
      </SafeAreaView>
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
  return (
    <SafeAreaView edges={SIDES} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1 },
  content: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH + 2 * space.lg,
    alignSelf: "center",
    padding: space.lg,
    gap: space.lg,
    paddingBottom: space.xxl,
  },
});
