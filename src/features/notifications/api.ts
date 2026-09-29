import type { ChatInfo, ChatRoom } from "@contract/chat";
import type { Me } from "@contract/core";
import type {
  ChatNotifyLevel,
  ChatNotifyResult,
  InboxOpenResult,
  InboxPage,
  InboxReadResult,
} from "@contract/notifications";
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";
import { INBOX_KEY } from "@/lib/push";

/**
 * お知らせ data (contract: src/contract/notifications.ts): the
 * notifications sent to the member, newest first, 30 per page, under
 * ["notifications"]; Me.badges.inbox counts the unseen ones. Also the
 * chat notification level (PUT /chat/:id/notifications).
 */

export function useInbox() {
  return useInfiniteQuery({
    queryKey: INBOX_KEY,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api<InboxPage>(
        pageParam
          ? `/notifications?cursor=${encodeURIComponent(pageParam)}`
          : "/notifications",
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

function setInboxBadge(queryClient: QueryClient, unread: number) {
  queryClient.setQueryData<Me>(
    ME_KEY,
    (me) => me && { ...me, badges: { ...me.badges, inbox: unread } },
  );
}

/** Show entries as read in the cached list (all when `ids` is null). */
function markReadLocally(queryClient: QueryClient, ids: string[] | null) {
  queryClient.setQueryData<InfiniteData<InboxPage>>(
    INBOX_KEY,
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((i) =>
            !i.read && (ids === null || ids.includes(i.id))
              ? { ...i, read: true }
              : i,
          ),
        })),
      },
  );
}

/**
 * The member has seen these entries in the list: the badge goes down, but
 * the list keeps showing them as new until it's next loaded.
 */
export function useMarkSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<InboxReadResult>("/notifications/read", { body: { ids } }),
    onSuccess: (r) => setInboxBadge(queryClient, r.unread),
  });
}

/** 「すべて既読にする」 */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<InboxReadResult>("/notifications/read", { body: {} }),
    onMutate: () => markReadLocally(queryClient, null),
    onSuccess: (r) => setInboxBadge(queryClient, r.unread),
  });
}

/** An entry was opened: recorded like tapping the notification. */
export function useOpenInboxItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<InboxOpenResult>("/notifications/open", { body: { id } }),
    onMutate: (id) => markReadLocally(queryClient, [id]),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ME_KEY }),
  });
}

/** A group's notification level (all / mentions / off). */
export function useChatNotifyLevel(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (level: ChatNotifyLevel) =>
      api<ChatNotifyResult>(
        `/chat/${encodeURIComponent(groupId)}/notifications`,
        { method: "PUT", body: { level } },
      ),
    onSuccess: ({ level }) => {
      const muted = level === "off";
      queryClient.setQueryData<ChatInfo>(
        ["chat", "info", groupId],
        (info) => info && { ...info, notifyLevel: level, muted },
      );
      queryClient.setQueryData<ChatRoom>(
        ["chat", "room", groupId],
        (room) => room && { ...room, notifyLevel: level, muted },
      );
    },
  });
}
