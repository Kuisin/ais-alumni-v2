import type { ChatMessage, ChatRoom } from "@contract/chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useRealtime, useRealtimeLive } from "@/lib/realtime";
import { chatApi, useRefreshChatBadges } from "../api";

/** Polling interval without Realtime (the website room's POLL_MS). */
const POLL_MS = 5000;

/** Merge by id (the newer copy, `b`, wins), oldest first. */
export function merge(
  a: readonly ChatMessage[],
  b: readonly ChatMessage[],
): ChatMessage[] {
  const byId = new Map(a.map((m) => [m.id, m]));
  for (const m of b) byId.set(m.id, m);
  return [...byId.values()].sort((x, y) =>
    x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0,
  );
}

const asDeleted = (m: ChatMessage): ChatMessage => ({
  ...m,
  body: "",
  deleted: true,
  mentionUserIds: [],
  mentionAll: false,
});

/**
 * A talk's messages and 既読, kept current like the website room
 * (chat-room.tsx): Realtime signals (or polling every 5 s without it) load
 * what's new through the API; older pages load on scrolling up; what's on
 * screen is marked read (throttled) while the talk is in front.
 *
 * `fresh`: the room data came from the server after the screen opened —
 * the 「ここから未読」 line is placed from it, once.
 */
export function useRoom({
  room,
  meId,
  focused,
  fresh,
}: {
  room: ChatRoom;
  meId: string;
  focused: boolean;
  fresh: boolean;
}) {
  const live = useRealtimeLive();
  const refreshBadges = useRefreshChatBadges();
  const [messages, setMessages] = useState<ChatMessage[]>(room.messages);
  const [reads, setReads] = useState<string[]>(room.reads);
  const [hasOlder, setHasOlder] = useState(room.hasOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** undefined = not placed yet; null = nothing unread */
  const [divider, setDivider] = useState<string | null | undefined>(undefined);

  const id = room.id;
  const member = room.member;
  const latest = useRef<string | undefined>(room.messages.at(-1)?.createdAt);
  const focusedRef = useRef(focused);
  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);
  useEffect(() => {
    latest.current = messages.at(-1)?.createdAt;
  }, [messages]);

  // Mark read (throttled) while the talk is in front.
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const markRead = useCallback(() => {
    if (!member) return;
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (!focusedRef.current || AppState.currentState !== "active") return;
      chatApi.markRead(id).then(refreshBadges, () => {});
    }, 1200);
  }, [id, member, refreshBadges]);
  useEffect(() => () => clearTimeout(readTimer.current), []);
  useEffect(() => {
    if (focused) markRead();
  }, [focused, markRead]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") markRead();
    });
    return () => sub.remove();
  }, [markRead]);

  const add = useCallback(
    (incoming: readonly ChatMessage[]) => {
      if (!incoming.length) return;
      setMessages((list) => merge(list, incoming));
      markRead();
    },
    [markRead],
  );

  // Signals carry ids only: load what's new (all of it, 200 at a time).
  const inFlight = useRef(false);
  const again = useRef(false);
  const fetchNew = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      for (let i = 0; i < 10; i++) {
        again.current = false;
        const page = await chatApi.messages(id, {
          after: latest.current ?? new Date(0).toISOString(),
        });
        const last = page.messages.at(-1);
        if (last) {
          if (!latest.current || last.createdAt > latest.current)
            latest.current = last.createdAt;
          add(page.messages);
        }
        if (!page.hasMore && !again.current) break;
      }
    } catch {
      // Offline for a moment: the next signal or poll catches up.
    } finally {
      inFlight.current = false;
    }
  }, [id, add]);

  const fetchReads = useCallback(async () => {
    const r = await chatApi.reads(id).catch(() => null);
    if (r) setReads(r.reads);
  }, [id]);

  useRealtime(room.topic, "message", () => void fetchNew());
  useRealtime(room.topic, "read", () => void fetchReads());
  useRealtime(room.topic, "delete", (p) => {
    const gone = typeof p.id === "string" ? p.id : null;
    if (gone)
      setMessages((list) =>
        list.map((m) => (m.id === gone ? asDeleted(m) : m)),
      );
  });

  // Without Realtime: poll for new messages and 既読 while in front.
  useEffect(() => {
    if (live || !focused) return;
    const timer = setInterval(() => {
      void fetchNew();
      void fetchReads();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [live, focused, fetchNew, fetchReads]);

  // Back in front (from the details screen …): catch up.
  const wasFocused = useRef(focused);
  useEffect(() => {
    if (focused && !wasFocused.current) {
      void fetchNew();
      void fetchReads();
    }
    wasFocused.current = focused;
  }, [focused, fetchNew, fetchReads]);

  // Fresh room data (pull to refresh, back from the background): update
  // what's on screen (deletions); anything newer comes in order through
  // fetchNew, so a long absence leaves no gap.
  const firstRoom = useRef(room);
  useEffect(() => {
    if (room === firstRoom.current) return;
    setMessages((list) => {
      const last = list.at(-1)?.createdAt ?? "";
      return merge(
        list,
        room.messages.filter((m) => m.createdAt <= last),
      );
    });
    setReads(room.reads);
    void fetchNew();
  }, [room, fetchNew]);

  // The unread line: where it was when the talk was opened.
  useEffect(() => {
    if (divider !== undefined || !fresh) return;
    const since = room.lastReadAt;
    setDivider(
      since
        ? (room.messages.find((m) => m.createdAt > since && m.userId !== meId)
            ?.id ?? null)
        : null,
    );
  }, [divider, fresh, room, meId]);

  const loadOlder = useCallback(async () => {
    const oldest = messages[0];
    if (loadingOlder || !hasOlder || !oldest) return;
    setLoadingOlder(true);
    try {
      const page = await chatApi.messages(id, { before: oldest.createdAt });
      setHasOlder(page.hasMore);
      setMessages((list) => merge(page.messages, list));
    } catch {
      // Try again on the next scroll.
    } finally {
      setLoadingOlder(false);
    }
  }, [id, messages, loadingOlder, hasOlder]);

  const send = useCallback(
    async (body: string) => {
      const { message } = await chatApi.send(id, body);
      add([message]);
      refreshBadges();
      return message;
    },
    [id, add, refreshBadges],
  );

  const remove = useCallback(
    async (messageId: string) => {
      await chatApi.remove(id, messageId);
      setMessages((list) =>
        list.map((m) => (m.id === messageId ? asDeleted(m) : m)),
      );
      refreshBadges();
    },
    [id, refreshBadges],
  );

  return {
    live,
    messages,
    reads,
    hasOlder,
    loadingOlder,
    divider: divider ?? null,
    loadOlder,
    send,
    remove,
  };
}
