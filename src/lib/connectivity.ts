import { useSyncExternalStore } from "react";

/**
 * Whether the server can be reached, as the API client last saw it
 * (src/lib/api.ts reports every request): a request that got no response
 * means offline — no network, or the server is down; any response means
 * online. The app keeps showing what it saved on the device meanwhile
 * (src/lib/query.ts); src/features/offline shows the indicator and probes
 * until the connection is back.
 */

let offline = false;
const listeners = new Set<() => void>();

export function reportReachable(reachable: boolean): void {
  if (offline === !reachable) return;
  offline = !reachable;
  for (const fn of listeners) fn();
}

export function isOffline(): boolean {
  return offline;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useOffline(): boolean {
  return useSyncExternalStore(subscribe, isOffline, () => false);
}
