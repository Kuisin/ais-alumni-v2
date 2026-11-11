import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { type Fold, FoldArea, useFoldArea } from "./fold";
import { ScreenSides } from "./screen";
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
 * Whether a FoldArea of this size has room for a list beside its detail,
 * and how wide the list is: up to the fold in the book pose (it runs top to
 * bottom — the panes meet there; the table pose's runs across, which lists
 * scroll past: it changes nothing), else `share` of the width between min
 * and max. `fold` is the book pose's fold, which nothing may sit under.
 */
export function panesLayout(
  area: ReturnType<typeof useFoldArea>,
  list: { min: number; max: number; share: number } = LIST_WIDTH,
): { wide: boolean; fold: Fold | null; listWidth: number } {
  const fold = area.fold?.axis === "vertical" ? area.fold : null;
  const wide = Boolean(fold) || area.width >= PANES_MIN_WIDTH;
  const listWidth = fold
    ? fold.x
    : Math.min(list.max, Math.max(list.min, area.width * list.share));
  return { wide, fold, listWidth };
}

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
  const { wide, fold, listWidth } = panesLayout(useFoldArea());
  return (
    <View style={styles.row}>
      <View style={wide ? { width: listWidth } : styles.fill}>
        <ScreenSides sides={wide ? LEFT : BOTH}>{list(wide)}</ScreenSides>
      </View>
      {wide ? (
        fold ? (
          <View style={{ width: fold.width }} />
        ) : (
          <View style={styles.divider} />
        )
      ) : null}
      {wide ? (
        <View style={styles.fill}>
          <ScreenSides sides={RIGHT}>{detail}</ScreenSides>
        </View>
      ) : null}
    </View>
  );
}

const LEFT = ["left"] as const;
const RIGHT = ["right"] as const;
const BOTH = ["left", "right"] as const;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
