import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorState, Loading } from "./states";

/**
 * Loading spinner / error with retry / content for one query — the usual
 * shell of a screen:  <QueryState query={q}>{(data) => …}</QueryState>
 */
export function QueryState<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <Loading />;
}
