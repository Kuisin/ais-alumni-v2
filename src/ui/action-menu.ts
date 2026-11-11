import type { RefObject } from "react";
import {
  ActionSheetIOS,
  findNodeHandle,
  type HostInstance,
  Platform,
} from "react-native";

export type MenuAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

export type ActionMenu = {
  title?: string;
  message?: string;
  actions: MenuAction[];
  cancelLabel: string;
};

/**
 * Plain menus and confirmations (a few actions, maybe destructive, and
 * cancel) are the system's action sheet on iOS, which iOS places — also on
 * the iPhone Duo, open or closed. Android and the web keep their Sheet
 * (src/ui/sheet.tsx): callers check this first.
 */
export const systemActionMenus = Platform.OS === "ios";

/**
 * iOS: shows `menu` as an action sheet (UIAlertController), the cancel
 * button last; an action runs after it has closed. `anchor`: the pressed
 * view, which a popover points at where iOS shows one (React Native passes
 * it on for the iPad idiom). Elsewhere it does nothing (see
 * systemActionMenus).
 */
export function showActionMenu(
  menu: ActionMenu,
  anchor?: RefObject<HostInstance | null>,
) {
  if (!systemActionMenus) return;
  const options = [...menu.actions.map((a) => a.label), menu.cancelLabel];
  const destructive = menu.actions.flatMap((a, i) =>
    a.destructive ? [i] : [],
  );
  const node = anchor?.current ? findNodeHandle(anchor.current) : null;
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: menu.title,
      message: menu.message,
      options,
      cancelButtonIndex: options.length - 1,
      destructiveButtonIndex: destructive,
      anchor: node ?? undefined,
    },
    (index) => menu.actions[index]?.onPress(),
  );
}
