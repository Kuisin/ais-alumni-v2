import type { Me } from "@contract/core";
import { type RealtimeChannel, RealtimeClient } from "@supabase/realtime-js";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { ME_KEY } from "./auth";

/**
 * Live updates, as on the website (src/components/realtime/realtime-provider.tsx):
 * signal-only Supabase Realtime Broadcast channels whose names come from
 * GET /me. Signals carry ids, never content; screens refetch through the
 * API. Without Realtime configured (or while disconnected) `live` is false
 * and screens should poll.
 *
 * Session-wide: the member's own channel ("refresh") and their chat groups
 * ("message") refresh the tab badges and the lists that show them.
 * Screens add handlers with useRealtime(topic, event, handler).
 */

type Payload = Record<string, unknown>;
type Handler = (payload: Payload) => void;

const EVENTS = ["message", "delete", "read", "refresh"] as const;

type Ctx = {
  live: boolean;
  on: (topic: string, event: string, handler: Handler) => () => void;
};

const RealtimeContext = createContext<Ctx>({ live: false, on: () => () => {} });

export function RealtimeProvider({
  config,
  children,
}: {
  config: Me["realtime"];
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const client = useRef<RealtimeClient | null>(null);
  const channels = useRef(new Map<string, RealtimeChannel>());
  const registry = useRef(new Map<string, Map<string, Set<Handler>>>());

  const join = useCallback((topic: string) => {
    const c = client.current;
    if (!c || channels.current.has(topic)) return;
    const ch = c.channel(topic);
    for (const event of EVENTS)
      ch.on("broadcast", { event }, (msg: { payload?: Payload }) => {
        const handlers = registry.current.get(topic)?.get(event);
        for (const h of handlers ?? []) h(msg.payload ?? {});
      });
    ch.subscribe();
    channels.current.set(topic, ch);
  }, []);

  const on = useCallback(
    (topic: string, event: string, handler: Handler) => {
      const byEvent =
        registry.current.get(topic) ?? new Map<string, Set<Handler>>();
      registry.current.set(topic, byEvent);
      const set = byEvent.get(event) ?? new Set<Handler>();
      byEvent.set(event, set);
      set.add(handler);
      join(topic);
      return () => {
        set.delete(handler);
      };
    },
    [join],
  );

  const url = config?.url;
  const key = config?.key;
  // Connected while the app is in the foreground.
  useEffect(() => {
    if (!url || !key) return;
    let stopped = false;
    const connect = () => {
      if (stopped || client.current) return;
      try {
        const c = new RealtimeClient(`${url}/realtime/v1`, {
          params: { apikey: key },
        });
        c.connect();
        client.current = c;
        setLive(true);
        for (const topic of registry.current.keys()) join(topic);
      } catch (e) {
        console.warn("[realtime] could not connect", e);
      }
    };
    const disconnect = () => {
      const c = client.current;
      client.current = null;
      channels.current.clear();
      setLive(false);
      if (c) {
        void c.removeAllChannels();
        c.disconnect();
      }
    };
    connect();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        connect();
        // Catch up on what happened while away.
        void queryClient.invalidateQueries();
      } else if (state === "background") disconnect();
    });
    return () => {
      stopped = true;
      sub.remove();
      disconnect();
    };
  }, [url, key, join, queryClient]);

  // Session-wide channels: badges and lists (debounced).
  const topicKey = (config?.topics ?? []).join(",");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = (fn: () => void) => {
      clearTimeout(timer);
      timer = setTimeout(fn, 800);
    };
    const offs = topicKey
      .split(",")
      .filter(Boolean)
      .map((topic) =>
        topic.startsWith("ais:user:")
          ? on(topic, "refresh", () =>
              soon(() => void queryClient.invalidateQueries()),
            )
          : on(topic, "message", () =>
              soon(() => {
                void queryClient.invalidateQueries({ queryKey: ME_KEY });
                void queryClient.invalidateQueries({
                  queryKey: ["chat", "list"],
                });
              }),
            ),
      );
    return () => {
      clearTimeout(timer);
      for (const off of offs) off();
    };
  }, [topicKey, on, queryClient]);

  return (
    <RealtimeContext.Provider value={{ live, on }}>
      {children}
    </RealtimeContext.Provider>
  );
}

/** Connected to Realtime (false = poll instead). */
export function useRealtimeLive(): boolean {
  return useContext(RealtimeContext).live;
}

/** Call `handler` for `event` broadcasts on `topic` while mounted. */
export function useRealtime(
  topic: string | null | undefined,
  event: string,
  handler: Handler,
): void {
  const { on } = useContext(RealtimeContext);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(
    () => (topic ? on(topic, event, (p) => ref.current(p)) : undefined),
    [on, topic, event],
  );
}
