import { isRunningInExpoGo } from "expo";
import { type ReactNode, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import {
  type ReservedRegion,
  ReservedRegionsProvider,
  useReservedRegions,
} from "react-native-reserved-regions";
import { colors } from "./theme";

/**
 * From this width the list and the detail sit side by side. The iPhone
 * Duo open leaves about 580 pt beside its tab sidebar, so the panes start
 * below that; a portrait iPhone (≤ 440 pt) and the folded Duo stay single.
 */
export const PANES_MIN_WIDTH = 560;
/** The list's share, kept between min and max; the detail gets the rest. */
const LIST_WIDTH = { min: 260, max: 400, share: 0.4 };

/**
 * A list with its detail beside it where there is room: the iPhone Duo
 * open, an iPad-wide window, a desktop browser. On the Duo the two panes
 * meet at the fold, so neither runs across it. Narrower, only the list
 * shows and the screen opens details as before.
 *
 * `list` learns which layout it's in (`wide`): side by side it selects into
 * the detail pane instead of pushing a screen.
 */
export function Panes({
  list,
  detail,
}: {
  list: (wide: boolean) => ReactNode;
  detail: ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);
  // The reserved-regions view is a native module: not in Expo Go.
  if (isRunningInExpoGo())
    return (
      <View style={styles.fill} onLayout={onLayout}>
        <PanesBody width={width} list={list} detail={detail} />
      </View>
    );
  return (
    <ReservedRegionsProvider style={styles.fill} onLayout={onLayout}>
      <FoldPanes width={width} list={list} detail={detail} />
    </ReservedRegionsProvider>
  );
}

type BodyProps = {
  width: number;
  list: (wide: boolean) => ReactNode;
  detail: ReactNode;
};

/** The panes, split at a fold running top to bottom (iPhone Duo open). */
function FoldPanes(props: BodyProps) {
  const fold = useReservedRegions().find(
    (r) => r.kind === "division" && r.frame.height > r.frame.width,
  );
  return <PanesBody {...props} fold={fold} />;
}

function PanesBody({
  width,
  list,
  detail,
  fold,
}: BodyProps & { fold?: ReservedRegion }) {
  const wide = Boolean(fold) || width >= PANES_MIN_WIDTH;
  if (!wide) return <View style={styles.fill}>{list(false)}</View>;
  const listWidth = fold
    ? fold.frame.x
    : Math.min(
        LIST_WIDTH.max,
        Math.max(LIST_WIDTH.min, width * LIST_WIDTH.share),
      );
  return (
    <View style={styles.row}>
      <View style={{ width: listWidth }}>{list(true)}</View>
      {fold ? (
        <View style={{ width: fold.frame.width }} />
      ) : (
        <View style={styles.divider} />
      )}
      <View style={styles.fill}>{detail}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
