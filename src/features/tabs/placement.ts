import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

/**
 * TEMPORARY (iPhone Duo testing): how iOS's native tab bar is placed,
 * switchable at runtime from 設定 (admins, iOS) so each option can be tried
 * on a real Duo without a new build. Once the right one is known, fix it in
 * (tabs)/_layout.ios.tsx and remove this file and the settings section.
 *  - "sidebar": preferredPlacement sidebar (the shipped behaviour)
 *  - "tabBar" / "automatic": preferredPlacement tabBar / automatic
 *  - "fixed": sidebarAdaptable={false} (never a sidebar)
 */
export type TabPlacement = "sidebar" | "tabBar" | "automatic" | "fixed";
export const TAB_PLACEMENTS: TabPlacement[] = [
  "sidebar",
  "tabBar",
  "automatic",
  "fixed",
];

const KEY = "ais.tabPlacement";
let current: TabPlacement = "sidebar";
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v && (TAB_PLACEMENTS as string[]).includes(v)) {
      current = v as TabPlacement;
      emit();
    }
  })
  .catch(() => {});

export function setTabPlacement(p: TabPlacement) {
  current = p;
  emit();
  AsyncStorage.setItem(KEY, p).catch(() => {});
}

export function useTabPlacement(): TabPlacement {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}
