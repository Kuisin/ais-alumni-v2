import { type Href, useNavigation, usePathname, useRouter } from "expo-router";
import { Header } from "expo-router/react-navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useMe } from "@/lib/auth";
import { stackScreenOptions } from "@/lib/navigation";
import { colors } from "@/ui";
import { FoldArea, useFoldArea } from "@/ui/fold";
import { panesLayout } from "@/ui/panes";
import { LeaveAdminButton } from "./leave-button";
import { adminSections } from "./nav";
import { ADMIN_PAGES } from "./paths";
import { AdminSectionList } from "./section-list";

/** The section list's width beside the sections (or up to the fold). */
const LIST_WIDTH = { min: 280, max: 320, share: 0.32 };

type Split = {
  /** the section list is beside the stack */
  wide: boolean;
  /** the stack's header height (admin/index reports it), for the list's */
  setHeaderHeight: (height: number) => void;
};

const SplitContext = createContext<Split>({
  wide: false,
  setHeaderHeight: () => {},
});

/** Inside 管理モード: whether the section list is beside the screens. */
export function useAdminSplit(): Split {
  return useContext(SplitContext);
}

/**
 * 管理モード on a wide window (the iPhone Duo open, an iPad-wide window, a
 * desktop browser): the section list on the left, the admin stack on the
 * right — a section's own screens (a queue → an application) push there,
 * with their headers. Narrower, the stack alone, as on a phone.
 *
 * `stack` is always the last child of the same row, behind slots for the
 * list and the divider that are empty when narrow (React keeps an empty
 * slot's place), so folding or unfolding the Duo keeps the stack — where
 * the member is in it — instead of building it again.
 */
export function AdminSplit({
  children,
}: {
  children: (wide: boolean) => ReactNode;
}) {
  return (
    <FoldArea style={styles.fill}>
      <SplitBody>{children}</SplitBody>
    </FoldArea>
  );
}

function SplitBody({ children }: { children: (wide: boolean) => ReactNode }) {
  const { wide, fold, listWidth } = panesLayout(useFoldArea(), LIST_WIDTH);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);
  const split = useMemo(() => ({ wide, setHeaderHeight }), [wide]);
  return (
    <SplitContext.Provider value={split}>
      <View style={styles.row}>
        {wide ? (
          <View style={{ width: listWidth }}>
            <ListColumn headerHeight={headerHeight} />
          </View>
        ) : null}
        {wide ? (
          fold ? (
            <View style={{ width: fold.width }} />
          ) : (
            <View style={styles.divider} />
          )
        ) : null}
        <View style={styles.fill}>{children(wide)}</View>
      </View>
    </SplitContext.Provider>
  );
}

/** The list column: its own header (as tall as the stack's) and scroll. */
function ListColumn({ headerHeight }: { headerHeight: number | null }) {
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  // The layout's navigation: 管理モード's screen in the member stack.
  const navigation = useNavigation();
  const groups = adminSections(me.access);
  const items = groups.flatMap((g) => g.items);
  const current = items.find((i) => {
    const href = String(i.href);
    return pathname === href || pathname.startsWith(`${href}/`);
  });

  const open = (href: string) => {
    if (current && String(current.href) === href) {
      // The same section: back to its first screen.
      if (pathname !== href) router.dismissTo(href as Href);
    } else if (pathname === "/admin") {
      router.push(href as Href);
    } else {
      // Another section: in place of the one shown, not on top of it.
      router.dismissAll();
      router.push(href as Href);
    }
  };

  // Leaving 管理モード from the list leaves it whatever the stack holds
  // (router.back() would pop the right pane instead).
  const leave = () =>
    navigation.canGoBack() ? navigation.goBack() : router.replace("/home");

  const {
    contentStyle: _content,
    headerBackButtonDisplayMode: _back,
    ...headerOptions
  } = stackScreenOptions;
  return (
    <View style={styles.fill}>
      <Header
        {...headerOptions}
        headerStyle={[
          headerOptions.headerStyle,
          headerHeight ? { height: headerHeight } : null,
        ]}
        title={tc("nav.adminMode")}
        headerLeft={() => <LeaveAdminButton onLeave={leave} />}
      />
      <AdminSectionList
        selected={current ? String(current.href) : null}
        onOpen={open}
      />
    </View>
  );
}

/**
 * Wide: the sections' first screens replace one another beside the list —
 * no back button to the empty admin/index, no swipe there, no slide in.
 */
export function sectionRootOptions(routeName: string, wide: boolean) {
  if (!wide || !SECTION_ROUTES.has(routeName)) return {};
  return {
    headerBackVisible: false,
    headerLeft: () => null,
    gestureEnabled: false,
    animation: "none",
  } as const;
}

/** admin/<section> route names (a file, or a folder's index). */
const SECTION_ROUTES = new Set(
  Object.values(ADMIN_PAGES).flatMap(({ href }) => {
    const name = href.replace(/^\/admin\//, "");
    return [name, `${name}/index`];
  }),
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
