import type { Home } from "@contract/home";
import type {
  MessageDetail,
  MessageList,
  NewsDetail,
  NewsHubOk,
  NewsList,
  NewsVoteRequest,
} from "@contract/news";
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { ApiError, api } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";

/**
 * ニュース data: the list (10 per page, as on the website, loaded page by
 * page as the member scrolls), one post, and the hub's answers. Keys:
 * ["news", "list"] (pages inside) and ["news", id].
 */

export const newsKeys = {
  lists: ["news", "list"] as const,
  detail: (id: string) => ["news", id] as const,
};

const HOME_KEY = ["home"] as const;

const path = (id: string, rest = "") =>
  `/news/${encodeURIComponent(id)}${rest}`;

export function useNewsList() {
  return useInfiniteQuery({
    queryKey: newsKeys.lists,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api<NewsList>(`/news?page=${pageParam}`, { signal }),
    // The website pages up to 1000.
    getNextPageParam: (last) =>
      last.hasNext && last.page < 1000 ? last.page + 1 : undefined,
  });
}

/** One post. Loading it records the read on the server (as the website). */
export function useNewsDetail(id: string) {
  return useQuery({
    queryKey: newsKeys.detail(id),
    queryFn: ({ signal }) => api<NewsDetail>(path(id), { signal }),
  });
}

/** Mark a post read in the cached list and Home (no refetch needed). */
function markReadLocally(queryClient: QueryClient, id: string) {
  queryClient.setQueriesData<InfiniteData<NewsList>>(
    { queryKey: newsKeys.lists },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          posts: page.posts.map((p) =>
            p.id === id && p.unread ? { ...p, unread: false } : p,
          ),
        })),
      },
  );
  queryClient.setQueryData<Home>(
    HOME_KEY,
    (home) =>
      home && {
        ...home,
        news: home.news.map((n) =>
          n.id === id && n.unread ? { ...n, unread: false } : n,
        ),
      },
  );
}

/**
 * Opening a post recorded the read (not for an admin-only view): update the
 * 未読 marks and the tab badge.
 */
export function useReadReceipt(post: NewsDetail | undefined) {
  const queryClient = useQueryClient();
  const id = post && !post.adminView ? post.id : null;
  useEffect(() => {
    if (!id) return;
    markReadLocally(queryClient, id);
    void queryClient.invalidateQueries({ queryKey: ME_KEY });
  }, [id, queryClient]);
}

/**
 * A hub action. Success refetches the post before the mutation settles (so
 * buttons stay busy until the new state shows); answers also change the
 * lists' 要回答 marks.
 */
function useHubAction<V>(
  id: string,
  send: (v: V) => Promise<NewsHubOk>,
  { answers = false }: { answers?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const key = newsKeys.detail(id);
  return useMutation({
    mutationFn: send,
    onSuccess: async () => {
      if (answers) {
        void queryClient.invalidateQueries({ queryKey: newsKeys.lists });
        void queryClient.invalidateQueries({ queryKey: HOME_KEY });
        void queryClient.invalidateQueries({ queryKey: ME_KEY });
      }
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: () => {
      // Refused (closed, comments off…): show the post as it is now.
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** 「確認しました」 (true) or take it back (false). */
export function useConfirm(id: string) {
  return useHubAction(
    id,
    (on: boolean) => api<NewsHubOk>(path(id, "/confirm"), { body: { on } }),
    { answers: true },
  );
}

/** Answer a poll or 日程調整. */
export function useVote(id: string) {
  return useHubAction(
    id,
    (body: NewsVoteRequest) => api<NewsHubOk>(path(id, "/vote"), { body }),
    { answers: true },
  );
}

export function useAddComment(id: string) {
  return useHubAction(id, (body: string) =>
    api<NewsHubOk>(path(id, "/comments"), { body: { body } }),
  );
}

export function useDeleteComment(id: string) {
  return useHubAction(id, (commentId: string) =>
    api<NewsHubOk>(path(id, `/comments/${encodeURIComponent(commentId)}`), {
      method: "DELETE",
    }),
  );
}

export function useHideComment(id: string) {
  return useHubAction(
    id,
    ({ commentId, hide }: { commentId: string; hide: boolean }) =>
      api<NewsHubOk>(
        path(id, `/comments/${encodeURIComponent(commentId)}/hide`),
        { body: { hide } },
      ),
  );
}

/** Toggle a reaction, shown at once (rolled back if refused). */
export function useToggleReaction(id: string) {
  const queryClient = useQueryClient();
  const key = newsKeys.detail(id);
  return useMutation({
    mutationFn: (emoji: string) =>
      api<NewsHubOk>(path(id, "/reactions"), { body: { emoji } }),
    onMutate: async (emoji) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<NewsDetail>(key);
      if (before)
        queryClient.setQueryData<NewsDetail>(key, {
          ...before,
          reactions: before.reactions.map((r) =>
            r.emoji === emoji
              ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) }
              : r,
          ),
        });
      return { before };
    },
    onError: (_e, _emoji, ctx) => {
      if (ctx?.before) queryClient.setQueryData(key, ctx.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** The hub's error codes are the website's news.hub.errors keys. */
const HUB_ERRORS = new Set(["closed", "invalid", "commentsOff", "forbidden"]);

/** What went wrong with a hub action, in the website's words. */
export function useHubErrorMessage(): (error: unknown) => string {
  const t = useTranslations("news.hub.errors");
  const tm = useTranslations("mobile.errors");
  return (error) => {
    if (error instanceof ApiError) {
      if (error.status === 0) return tm("network");
      if (HUB_ERRORS.has(error.code)) return t(error.code);
      if (error.status === 403 || error.status === 404) return t("forbidden");
    }
    return t("generic");
  };
}

// ---- あなた宛ての連絡 (only while me.features.messages) ----

export const messageKeys = {
  list: ["news", "messages"] as const,
  detail: (id: string) => ["news", "messages", id] as const,
};

export function useMessageList(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: messageKeys.list,
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api<MessageList>(`/news/messages?page=${pageParam}`, { signal }),
    getNextPageParam: (last) =>
      last.hasNext && last.page < 1000 ? last.page + 1 : undefined,
  });
}

/** One message. Loading it records the read, so the badges follow. */
export function useMessage(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: messageKeys.detail(id),
    queryFn: async ({ signal }) => {
      const m = await api<MessageDetail>(
        `/news/messages/${encodeURIComponent(id)}`,
        { signal },
      );
      void queryClient.invalidateQueries({ queryKey: messageKeys.list });
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
      void queryClient.invalidateQueries({ queryKey: HOME_KEY });
      return m;
    },
  });
}
