import type { Home } from "@contract/home";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** ホーム data (the website's dashboard). Key: ["home"]. */

export const HOME_KEY = ["home"] as const;

export function useHome() {
  return useQuery({
    queryKey: HOME_KEY,
    queryFn: ({ signal }) => api<Home>("/home", { signal }),
  });
}

/** 「今はしない」: hides the LINE banner for 30 days (at once, here). */
export function useDismissLineBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ ok: true }>("/home/line-banner/dismiss", { method: "POST" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: HOME_KEY });
      const before = queryClient.getQueryData<Home>(HOME_KEY);
      if (before)
        queryClient.setQueryData<Home>(HOME_KEY, { ...before, line: null });
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) queryClient.setQueryData(HOME_KEY, ctx.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: HOME_KEY }),
  });
}
