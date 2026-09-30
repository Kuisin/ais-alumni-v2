import type {
  ChatInfo,
  ChatList,
  ChatMessagesPage,
  ChatReactionsResult,
  ChatReads,
  ChatRoom,
  DirectCandidates,
  MuteResult,
  OkResult,
  ReportRequest,
  ReportResult,
  SendMessageResult,
  StartDirectError,
  StartDirectResult,
} from "@contract/chat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslations } from "use-intl";
import { api, isApiError } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";

/**
 * Chat data (contract: src/contract/chat.ts). The list is
 * ["chat", "list"] and a talk ["chat", "room", id] — the session-wide
 * realtime handler (src/lib/realtime.tsx) refreshes the list and the tab
 * badge on every "message" signal.
 */

export const CHAT_LIST_KEY = ["chat", "list"] as const;
export const roomKey = (id: string) => ["chat", "room", id] as const;
export const infoKey = (id: string) => ["chat", "info", id] as const;
export const DIRECT_KEY = ["chat", "direct"] as const;

const path = (id: string, rest = "") =>
  `/chat/${encodeURIComponent(id)}${rest}`;

export function useChatList() {
  return useQuery({
    queryKey: CHAT_LIST_KEY,
    queryFn: () => api<ChatList>("/chat"),
  });
}

export function useChatRoom(id: string) {
  return useQuery({
    queryKey: roomKey(id),
    queryFn: () => api<ChatRoom>(path(id)),
    // Shown at once from the cache; the unread line waits for fresh data.
    refetchOnMount: "always",
  });
}

export function useChatInfo(id: string) {
  return useQuery({
    queryKey: infoKey(id),
    queryFn: () => api<ChatInfo>(path(id, "/info")),
  });
}

export function useDirectCandidates() {
  return useQuery({
    queryKey: DIRECT_KEY,
    queryFn: () => api<DirectCandidates>("/chat/direct"),
  });
}

export const chatApi = {
  messages: (id: string, q: { before?: string; after?: string }) => {
    const qs = q.before
      ? `?before=${encodeURIComponent(q.before)}`
      : q.after
        ? `?after=${encodeURIComponent(q.after)}`
        : "";
    return api<ChatMessagesPage>(path(id, `/messages${qs}`));
  },
  send: (id: string, body: string) =>
    api<SendMessageResult>(path(id, "/messages"), { body: { body } }),
  remove: (id: string, messageId: string) =>
    api<OkResult>(path(id, `/messages/${encodeURIComponent(messageId)}`), {
      method: "DELETE",
    }),
  /** The member's reaction with `emoji` on or off. */
  react: (id: string, messageId: string, emoji: string) =>
    api<ChatReactionsResult>(
      path(id, `/messages/${encodeURIComponent(messageId)}/reactions`),
      { body: { emoji } },
    ),
  reactions: (id: string, messageId: string) =>
    api<ChatReactionsResult>(
      path(id, `/messages/${encodeURIComponent(messageId)}/reactions`),
    ),
  reads: (id: string) => api<ChatReads>(path(id, "/read")),
  markRead: (id: string) =>
    api<OkResult>(path(id, "/read"), { method: "POST" }),
  mute: (id: string, muted: boolean) =>
    api<MuteResult>(path(id, "/mute"), { method: "PUT", body: { muted } }),
  report: (id: string, body: ReportRequest) =>
    api<ReportResult>(path(id, "/report"), { body }),
  startDirect: (userId: string) =>
    api<StartDirectResult>("/chat/direct", { body: { userId } }),
};

/** Badges and the talk list after something changed in a talk. */
export function useRefreshChatBadges() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ME_KEY });
    void queryClient.invalidateQueries({ queryKey: CHAT_LIST_KEY });
  }, [queryClient]);
}

const START_ERRORS: StartDirectError[] = [
  "disabled",
  "self",
  "notFound",
  "restricted",
  "notFriends",
  "blocked",
  "forbidden",
];

/**
 * Open (or create) the 1:1 talk with a member and go there — the
 * website's useStartTalk (start-talk.tsx). `replace`: instead of the
 * current screen (the new-talk list).
 */
export function useStartTalk({ replace = false }: { replace?: boolean } = {}) {
  const t = useTranslations("chat.new.errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = async (userId: string) => {
    if (pending) return;
    setPending(userId);
    setError(null);
    try {
      const { groupId } = await chatApi.startDirect(userId);
      // The new talk's realtime channel comes with /me.
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
      const href = { pathname: "/chat/[id]", params: { id: groupId } } as const;
      if (replace) router.replace(href);
      else router.push(href);
    } catch (e) {
      const code = isApiError(e) ? e.code : "forbidden";
      setError(
        t(
          START_ERRORS.includes(code as StartDirectError)
            ? (code as StartDirectError)
            : "forbidden",
        ),
      );
    } finally {
      setPending(null);
    }
  };
  return { open, pending, error };
}
