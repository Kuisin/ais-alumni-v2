import type {
  AdminNewsDetail,
  AdminNewsDone,
  AdminNewsList,
  AdminNewsNotifyEstimate,
} from "@contract/admin-news";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";

/**
 * ニュース管理 (admin mode): the list (30 per page, as on the website,
 * loaded page by page), one post, and its actions. Keys:
 * ["admin", "news", "list", archived] and ["admin", "news", id].
 */

export const adminNewsKeys = {
  all: ["admin", "news"] as const,
  list: (archived: boolean) => ["admin", "news", "list", archived] as const,
  detail: (id: string) => ["admin", "news", id] as const,
  estimate: (id: string) => ["admin", "news", id, "notify"] as const,
};

const path = (id: string, rest = "") =>
  `/admin/news/${encodeURIComponent(id)}${rest}`;

export function useAdminNewsList(archived: boolean) {
  return useInfiniteQuery({
    queryKey: adminNewsKeys.list(archived),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api<AdminNewsList>(
        `/admin/news?page=${pageParam}${archived ? "&archived=1" : ""}`,
        { signal },
      ),
    // The website pages up to 1000.
    getNextPageParam: (last) =>
      last.hasNext && last.page < 1000 ? last.page + 1 : undefined,
    // Switching tabs keeps the list on screen until the other one loads.
    placeholderData: keepPreviousData,
  });
}

export function useAdminNews(id: string) {
  return useQuery({
    queryKey: adminNewsKeys.detail(id),
    queryFn: ({ signal }) => api<AdminNewsDetail>(path(id), { signal }),
  });
}

/** 通知内容の確認: recipients and message counts (when asked for). */
export function useNotifyEstimate(id: string, enabled: boolean) {
  return useQuery({
    queryKey: adminNewsKeys.estimate(id),
    queryFn: ({ signal }) =>
      api<AdminNewsNotifyEstimate>(path(id, "/notify"), { signal }),
    enabled,
    // Counts as of now, every time the step opens.
    gcTime: 0,
  });
}

/**
 * A change to a post: refetch it (before the mutation settles, so buttons
 * stay busy until the new state shows), the admin lists and the member-side
 * news (a post may have been published, archived or deleted).
 */
function useNewsChange<V>(id: string, send: (v: V) => Promise<AdminNewsDone>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: async () => {
      void queryClient.invalidateQueries({
        queryKey: adminNewsKeys.all,
        predicate: (q) => q.queryKey[2] === "list",
      });
      void queryClient.invalidateQueries({ queryKey: ["news"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
      await queryClient.invalidateQueries({
        queryKey: adminNewsKeys.detail(id),
        exact: true,
      });
    },
  });
}

/** 公開して通知 (confirmed): publishes now if needed, notifies once. */
export function useNotifyNews(id: string) {
  return useNewsChange(id, () =>
    api<AdminNewsDone>(path(id, "/notify"), { method: "POST" }),
  );
}

export function useApproveNews(id: string) {
  return useNewsChange(id, () =>
    api<AdminNewsDone>(path(id, "/approve"), { method: "POST" }),
  );
}

export function useArchiveNews(id: string) {
  return useNewsChange(id, (archive: boolean) =>
    api<AdminNewsDone>(path(id, "/archive"), { body: { archive } }),
  );
}

export function useCloseNews(id: string) {
  return useNewsChange(id, (close: boolean) =>
    api<AdminNewsDone>(path(id, "/close"), { body: { close } }),
  );
}

export function useDeleteNews(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<AdminNewsDone>(path(id), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminNewsKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: adminNewsKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["news"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}
