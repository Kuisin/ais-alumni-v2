import type {
  AdminEventApproved,
  AdminEventDetail,
  AdminEventDone,
  AdminEventList,
  AdminRsvpClosedRequest,
  AdminStaffCandidate,
  AdminStaffRequest,
} from "@contract/admin-events";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * 管理モード → イベント管理 data. Keys: ["admin", "events", "list"],
 * ["admin", "events", id] and ["admin", "events", id, "staff", q].
 * Changes also refresh the member-side events and Home.
 */

export const adminEventKeys = {
  all: ["admin", "events"] as const,
  list: ["admin", "events", "list"] as const,
  detail: (id: string) => ["admin", "events", id] as const,
  staffSearch: (id: string, q: string) =>
    ["admin", "events", id, "staff", q] as const,
};

const path = (id: string) => `/admin/events/${encodeURIComponent(id)}`;

export function useAdminEvents() {
  return useQuery({
    queryKey: adminEventKeys.list,
    queryFn: ({ signal }) => api<AdminEventList>("/admin/events", { signal }),
  });
}

export function useAdminEvent(id: string) {
  return useQuery({
    queryKey: adminEventKeys.detail(id),
    queryFn: ({ signal }) => api<AdminEventDetail>(path(id), { signal }),
  });
}

/** After a change: this event, the admin list, member lists and Home. */
function useRefresh(id: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: adminEventKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: adminEventKeys.list });
    void queryClient.invalidateQueries({ queryKey: ["events"] });
    void queryClient.invalidateQueries({ queryKey: ["home"] });
  };
}

export function useApproveEvent(id: string) {
  const refresh = useRefresh(id);
  return useMutation({
    mutationFn: () =>
      api<AdminEventApproved>(`${path(id)}/approve`, { method: "POST" }),
    onSettled: refresh,
  });
}

export function useSetRsvpClosed(id: string) {
  const refresh = useRefresh(id);
  return useMutation({
    mutationFn: (body: AdminRsvpClosedRequest) =>
      api<AdminEventDone>(`${path(id)}/rsvp-closed`, { body }),
    onSettled: refresh,
  });
}

export function useDeleteEvent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<AdminEventDone>(path(id), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminEventKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: adminEventKeys.list });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
    },
  });
}

/** Members to add as 受付スタッフ (name search, 10 at most). */
export function useStaffSearch(id: string, q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: adminEventKeys.staffSearch(id, term),
    queryFn: ({ signal }) =>
      api<AdminStaffCandidate[]>(
        `${path(id)}/staff?q=${encodeURIComponent(term)}`,
        { signal },
      ),
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useSetStaff(id: string) {
  const refresh = useRefresh(id);
  return useMutation({
    mutationFn: (body: AdminStaffRequest) =>
      api<AdminEventDone>(`${path(id)}/staff`, { body }),
    onSettled: refresh,
  });
}
