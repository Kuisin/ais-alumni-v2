import type { Home, HomeLineLink } from "@contract/home";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { api } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";

/** ホーム data (the website's dashboard). Key: ["home"]. */

export const HOME_KEY = ["home"] as const;

export function useHome() {
  return useQuery({
    queryKey: HOME_KEY,
    queryFn: ({ signal }) => api<Home>("/home", { signal }),
  });
}

/**
 * 「LINE を連携する」: a fresh linking URL (valid 10 minutes), opened in the
 * browser. When the member comes back, Home and the badges reload (the
 * checklist and the banner follow the new state).
 */
export function useLinkLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { url } = await api<HomeLineLink>("/home/line-link", {
        method: "POST",
      });
      await WebBrowser.openBrowserAsync(url);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: HOME_KEY });
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
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
