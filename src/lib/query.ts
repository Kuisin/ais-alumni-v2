import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { ApiError } from "./api";

/**
 * Server data is cached with TanStack Query. Screens refetch when the app
 * comes back to the foreground, on pull-to-refresh, and when a realtime
 * signal says something changed (src/lib/realtime.tsx).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
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
