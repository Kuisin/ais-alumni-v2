import type {
  CheckInBoard,
  CheckInCandidate,
  CheckInRequest,
  CheckInResult,
  EventDetail,
  EventList,
  EventTab,
  RsvpRequest,
  RsvpResult,
} from "@contract/events";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { ApiError, api } from "@/lib/api";

/**
 * イベント data: the list (20 per page, as on the website), one event, and
 * the RSVP. Keys: ["events", "list", tab] and ["events", id].
 */

export const eventKeys = {
  lists: ["events", "list"] as const,
  list: (tab: EventTab) => ["events", "list", tab] as const,
  detail: (id: string) => ["events", id] as const,
};

export function useEventList(tab: EventTab) {
  return useInfiniteQuery({
    queryKey: eventKeys.list(tab),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api<EventList>(`/events?tab=${tab}&page=${pageParam}`, { signal }),
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: ({ signal }) =>
      api<EventDetail>(`/events/${encodeURIComponent(id)}`, { signal }),
  });
}

/**
 * Answer / change the RSVP. The response is the event as it is now, so the
 * screen updates at once; the lists (my answer) and Home follow.
 */
export function useRsvp(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RsvpRequest) =>
      api<RsvpResult>(`/events/${encodeURIComponent(id)}/rsvp`, { body }),
    onSuccess: (result) => {
      queryClient.setQueryData(eventKeys.detail(id), result.event);
    },
    onError: () => {
      // Refused (full, closed…): show the event as it is now.
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(id) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.lists });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
    },
  });
}

/** API error codes → the website's events.rsvp.errors.* keys. */
const RSVP_ERRORS: Record<string, string> = {
  closed: "closed",
  capacity: "capacity",
  guests: "guests",
  invalid: "validation",
  not_found: "notFound",
  forbidden: "forbidden",
  inactive: "forbidden",
  unauthenticated: "forbidden",
};

/** What went wrong with an RSVP, in the website's words. */
export function useRsvpErrorMessage(): (error: unknown) => string {
  const t = useTranslations("events.rsvp.errors");
  const tm = useTranslations("mobile.errors");
  return (error) => {
    if (error instanceof ApiError) {
      if (error.status === 0) return tm("network");
      const key = RSVP_ERRORS[error.code];
      if (key) return t(key);
    }
    return t("generic");
  };
}

// ---- Check-in (staff) ----

export const checkInKey = (id: string) => ["events", id, "check-in"] as const;

export function useCheckInBoard(id: string) {
  return useQuery({
    queryKey: checkInKey(id),
    queryFn: ({ signal }) =>
      api<CheckInBoard>(`/events/${encodeURIComponent(id)}/check-in`, {
        signal,
      }),
  });
}

/** Check in a scanned ticket or a member from the list. */
export function checkIn(id: string, body: CheckInRequest) {
  return api<CheckInResult>(`/events/${encodeURIComponent(id)}/check-in`, {
    body,
  });
}

export function undoCheckIn(id: string, userId: string) {
  return api<{ ok: boolean }>(
    `/events/${encodeURIComponent(id)}/check-in/undo`,
    { body: { userId } },
  );
}

export function searchCheckIn(id: string, q: string) {
  return api<{ candidates: CheckInCandidate[] }>(
    `/events/${encodeURIComponent(id)}/check-in/search?q=${encodeURIComponent(q)}`,
  );
}
