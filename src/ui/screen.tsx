import { createContext, type ReactNode, type Ref, useContext } from "react";
import {
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  type ScrollViewProps,
  StyleSheet,
  View,
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

type Side = (typeof SIDES)[number];

/**
 * The screen edges a panel touches. Side by side (Panes, 管理モード's split)
 * the left panel touches only the left edge and the right one only the
 * right: the iPhone Duo's vertical bar beside the right panel mustn't pad
 * the left one. SafeAreaView reports the window's insets, so each panel
 * says which edges are its own.
 */
const SidesContext = createContext<readonly Side[]>(SIDES);

export function ScreenSides({
  sides,
  children,
}: {
  sides: readonly Side[];
  children: ReactNode;
}) {
  return (
    <SidesContext.Provider value={sides}>{children}</SidesContext.Provider>
  );
}

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
  const sides = useContext(SidesContext);
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
      {/* The side bar first, across the full width (its inset is the part
          of it over the page), then the column centred in what's left. */}
      <SafeAreaView edges={sides} style={styles.sides}>
        <View style={[styles.content, contentStyle]}>{children}</View>
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
  const sides = useContext(SidesContext);
  return (
    <SafeAreaView edges={sides} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1 },
  sides: { flexGrow: 1 },
  content: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH + 2 * space.lg,
    alignSelf: "center",
    padding: space.lg,
    gap: space.lg,
    paddingBottom: space.xxl,
  },
});
