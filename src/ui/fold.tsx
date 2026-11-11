import { isRunningInExpoGo } from "expo";
import { createContext, type ReactNode, useContext, useState } from "react";
import {
  type LayoutChangeEvent,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import {
  type ReservedRegion,
  ReservedRegionsProvider,
  useReservedRegions,
} from "react-native-reserved-regions";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The iPhone Duo's fold, for layouts that must not run across it. Its three
 * states:
 *  - closed: the outer display (about 466 × 678 pt), the system's vertical
 *    bar at its right edge (a left/right safe-area inset) — no fold;
 *  - open flat: the inner display (669 × 951 pt), no fold;
 *  - half open: the inner display with the fold reported as a division —
 *    running top to bottom in the book pose (left and right halves), across
 *    in the table pose (content above, controls below).
 * UIKit reports it through reserved regions (react-native-reserved-regions,
 * iOS 27.1 SDK; Android's folding features too). The regions are relative
 * to the FoldArea that asks, so each area measures its own.
 */
export type Fold = {
  /** "vertical": book pose, halves left and right; "horizontal": table pose */
  axis: "vertical" | "horizontal";
  x: number;
  y: number;
  width: number;
  height: number;
};

/** The active fold among the regions; a zero-size one is a flat device. */
export function foldOf(regions: readonly ReservedRegion[]): Fold | null {
  for (const r of regions) {
    if (r.kind !== "division") continue;
    const { x, y, width, height } = r.frame;
    if (width <= 0 || height <= 0) continue;
    return {
      axis: height > width ? "vertical" : "horizontal",
      x,
      y,
      width,
      height,
    };
  }
  return null;
}

type Area = { fold: Fold | null; width: number; height: number };

const AreaContext = createContext<Area>({ fold: null, width: 0, height: 0 });

/** The nearest FoldArea's fold and size (no fold outside one). */
export function useFoldArea(): Area {
  return useContext(AreaContext);
}

/**
 * A View that knows where the fold crosses it (useFoldArea below it). In
 * Expo Go, which lacks the native module, it never sees one.
 */
export function FoldArea({ children, onLayout, ...props }: ViewProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const layout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) =>
      s.width === width && s.height === height ? s : { width, height },
    );
    onLayout?.(e);
  };
  if (isRunningInExpoGo())
    return (
      <View {...props} onLayout={layout}>
        <AreaContext.Provider value={{ fold: null, ...size }}>
          {children}
        </AreaContext.Provider>
      </View>
    );
  return (
    <ReservedRegionsProvider {...props} onLayout={layout}>
      <FoldReader size={size}>{children}</FoldReader>
    </ReservedRegionsProvider>
  );
}

function FoldReader({
  size,
  children,
}: {
  size: { width: number; height: number };
  children: ReactNode;
}) {
  const found = foldOf(useReservedRegions());
  // Regions aren't clipped to the area: one that misses it isn't its fold.
  const fold =
    found &&
    size.width > 0 &&
    found.x < size.width &&
    found.x + found.width > 0 &&
    found.y < size.height &&
    found.y + found.height > 0
      ? found
      : null;
  return (
    <AreaContext.Provider value={{ fold, ...size }}>
      {children}
    </AreaContext.Provider>
  );
}

/** Sheets and dialogs are at most this wide, centred, on a wide display. */
export const SHEET_MAX_WIDTH = 560;

/**
 * Android and the web: where an app-drawn bottom sheet over the whole
 * screen goes (src/ui/sheet.tsx, the chat's message sheet; in a full-screen
 * Modal,
 * around the sheet, filling the rest of it; the dimmed backdrop stays
 * outside it, full screen and behind):
 *  - clear of the side bar (the Duo closed: its right edge);
 *  - book pose: on the half after the fold, where the system puts alerts —
 *    never across the fold;
 *  - table pose: in the lower half, below the fold, with the controls;
 *  - at most SHEET_MAX_WIDTH wide, at the bottom.
 * The sheet's own maxHeight ("88%"…) is of what's left. useSheetArea gives
 * the room, e.g. for a grid's columns. iOS draws none of these: it uses
 * the system's action sheets (src/ui/action-menu.ts), page sheets (Modal
 * presentationStyle="pageSheet") and compact date pickers, which iOS
 * places itself, clear of the fold and the side bar.
 */
export function SheetPlacement({ children }: { children: ReactNode }) {
  return (
    <FoldArea style={styles.fill} pointerEvents="box-none">
      <Placed>{children}</Placed>
    </FoldArea>
  );
}

/** Less room than this below a fold across: the sheet ignores the fold. */
const MIN_BELOW_FOLD = 240;

const SheetAreaContext = createContext<{ width: number; height: number }>({
  width: 0,
  height: 0,
});

/** The room a sheet has inside SheetPlacement (0 before it's measured). */
export function useSheetArea() {
  return useContext(SheetAreaContext);
}

/**
 * Padding that keeps content in one part of the area: past a fold running
 * top to bottom (the half where the system puts alerts), below one running
 * across (where the controls go) when there's room, and clear of the side
 * bar.
 */
function useAvoidFold(safeArea: boolean) {
  const { fold, width, height } = useFoldArea();
  const safe = useSafeAreaInsets();
  const insets = safeArea ? safe : { left: 0, right: 0, top: 0 };
  let left = insets.left;
  const right = insets.right;
  let top = insets.top;
  if (fold?.axis === "vertical") {
    left = Math.max(left, fold.x + fold.width);
  } else if (
    fold?.axis === "horizontal" &&
    // Not when the keyboard has taken the lower half: then above it.
    height - (fold.y + fold.height) >= MIN_BELOW_FOLD
  ) {
    top = Math.max(top, fold.y + fold.height);
  }
  return { left, right, top, width, height };
}

function Placed({ children }: { children: ReactNode }) {
  const { left, right, top, width, height } = useAvoidFold(true);
  const room = {
    width: Math.max(0, Math.min(SHEET_MAX_WIDTH, width - left - right)),
    height: Math.max(0, height - top),
  };
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.placed,
        { paddingLeft: left, paddingRight: right, paddingTop: top },
      ]}
    >
      <SheetAreaContext.Provider value={room}>
        {children}
      </SheetAreaContext.Provider>
    </View>
  );
}

/**
 * A full-screen message with its buttons (offline, update required, an
 * error), centred — on the half-open iPhone Duo in the part that doesn't
 * cross the fold (like SheetPlacement), and at most SHEET_MAX_WIDTH wide.
 * `safeArea`: full screen — its padding replaces a SafeAreaView's left,
 * right and top (keep the SafeAreaView for the bottom only).
 */
export function FoldCenter({
  children,
  style,
  safeArea = false,
}: {
  children: ReactNode;
  style?: ViewProps["style"];
  safeArea?: boolean;
}) {
  return (
    <FoldArea style={styles.fill}>
      <Centered style={style} safeArea={safeArea}>
        {children}
      </Centered>
    </FoldArea>
  );
}

function Centered({
  children,
  style,
  safeArea,
}: {
  children: ReactNode;
  style?: ViewProps["style"];
  safeArea: boolean;
}) {
  const { left, right, top } = useAvoidFold(safeArea);
  return (
    <View
      style={[
        styles.centered,
        { paddingLeft: left, paddingRight: right, paddingTop: top },
      ]}
    >
      <View style={[styles.column, style]}>{children}</View>
    </View>
  );
}

/** For the sheet itself: full width up to SHEET_MAX_WIDTH. */
export const sheetWidth = {
  width: "100%",
  maxWidth: SHEET_MAX_WIDTH,
  alignSelf: "center",
} as const;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  placed: { flex: 1, justifyContent: "flex-end" },
  centered: { flex: 1, justifyContent: "center" },
  column: { width: "100%", maxWidth: SHEET_MAX_WIDTH, alignSelf: "center" },
});
