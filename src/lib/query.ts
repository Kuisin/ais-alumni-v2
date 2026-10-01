import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  defaultShouldDehydrateQuery,
  focusManager,
  type Query,
  QueryClient,
} from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { ApiError } from "./api";

/**
 * Server data is cached with TanStack Query. Screens refetch when the app
 * comes back to the foreground, on pull-to-refresh, and when a realtime
 * signal says something changed (src/lib/realtime.tsx).
 *
 * The cache is also kept on the device (AsyncStorage) so the app opens
 * instantly with what was there last time and refreshes in the background
 * — see PERSISTED below for what is kept. Cleared on sign-out.
 */

/** Kept on the device this long (and in memory at least as long). */
const KEEP_MS = 3 * 24 * 60 * 60_000;
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // As long as the device copy is kept (TanStack requires gcTime ≥ maxAge).
      gcTime: KEEP_MS,
      // Retry only what might work next time: no response or a 5xx.
      retry: (count, error) =>
        count < 2 &&
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500),
    },
    mutations: { retry: false },
  },
});

if (Platform.OS !== "web") {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener("change", (state) =>
      handleFocus(state === "active"),
    );
    return () => sub.remove();
  });
}

/**
 * What is kept on the device, by the first part of the query key: the
 * member's own account and what the tabs show. Not kept: the people list
 * (名簿 "directory", member profiles "members", "follows", the chat member
 * picker ["chat", "direct"]), admin mode, and anything not listed here.
 */
const PERSISTED = new Set([
  "me",
  "config",
  "home",
  "news",
  "events",
  "chat",
  "notifications",
  "settings",
  "profile",
  "push",
]);

function persisted(query: Query): boolean {
  const [root, sub] = query.queryKey as unknown[];
  if (typeof root !== "string" || !PERSISTED.has(root)) return false;
  if (root === "chat" && sub === "direct") return false;
  return defaultShouldDehydrateQuery(query);
}

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "ais.queryCache",
  throttleTime: 1000,
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: queryPersister,
  maxAge: KEEP_MS,
  // A new app version starts from an empty cache (response shapes may change).
  buster: Constants.expoConfig?.version ?? "dev",
  dehydrateOptions: { shouldDehydrateQuery: persisted },
};

/** Sign-out: forget the device copy too. */
export async function clearPersistedCache(): Promise<void> {
  try {
    await queryPersister.removeClient();
  } catch {
    // Nothing stored, or storage unavailable: nothing to forget.
  }
}
