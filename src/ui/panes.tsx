import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { FoldArea, useFoldArea } from "./fold";
import { colors } from "./theme";

/**
 * From this width the list and the detail sit side by side: the iPhone Duo
 * open (669 pt, or 951 less its side bar); a portrait iPhone (≤ 440 pt)
 * and the folded Duo (466 pt) stay single.
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
  return (
    <FoldArea style={styles.fill}>
      <PanesBody list={list} detail={detail} />
    </FoldArea>
  );
}

/**
 * The same tree in every state — the list first, the detail beside it only
 * when wide — so folding or unfolding the Duo keeps the list (its scroll
 * position, what's typed in it) instead of building it again.
 */
function PanesBody({
  list,
  detail,
}: {
  list: (wide: boolean) => ReactNode;
  detail: ReactNode;
}) {
  const area = useFoldArea();
  // The book pose's fold runs top to bottom: the panes meet there. The
  // table pose's runs across, which lists scroll past: it changes nothing.
  const fold = area.fold?.axis === "vertical" ? area.fold : null;
  const width = area.width;
  const wide = Boolean(fold) || width >= PANES_MIN_WIDTH;
  const listWidth = fold
    ? fold.x
    : Math.min(
        LIST_WIDTH.max,
        Math.max(LIST_WIDTH.min, width * LIST_WIDTH.share),
      );
  return (
    <View style={styles.row}>
      <View style={wide ? { width: listWidth } : styles.fill}>
        {list(wide)}
      </View>
      {wide ? (
        fold ? (
          <View style={{ width: fold.width }} />
        ) : (
          <View style={styles.divider} />
        )
      ) : null}
      {wide ? <View style={styles.fill}>{detail}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
