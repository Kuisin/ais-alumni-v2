import type {
  AdminNameDecisionBody,
  AdminNameDecisionResult,
  AdminNameRequests,
  AdminRecordDecisionBody,
  AdminRecordDecisionResult,
  AdminRecordRequests,
  AdminRequestTab,
} from "@contract/admin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";
import { ADMIN_KEY } from "../api";

export function useAdminNameRequests(tab: AdminRequestTab) {
  return useQuery({
    queryKey: ["admin", "name-requests", tab],
    queryFn: ({ signal }) =>
      api<AdminNameRequests>(`/admin/name-requests?tab=${tab}`, { signal }),
  });
}

export function useAdminRecordRequests(tab: AdminRequestTab) {
  return useQuery({
    queryKey: ["admin", "record-requests", tab],
    queryFn: ({ signal }) =>
      api<AdminRecordRequests>(`/admin/record-requests?tab=${tab}`, {
        signal,
      }),
  });
}

/** After a decision: the lists, the admin badges and the account's. */
function useRefreshAfterDecision() {
  const queryClient = useQueryClient();
  return (ok: boolean) => {
    if (!ok) return;
    void queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    void queryClient.invalidateQueries({ queryKey: ME_KEY });
  };
}

export function useDecideNameRequest(id: string) {
  const refresh = useRefreshAfterDecision();
  return useMutation({
    mutationFn: (body: AdminNameDecisionBody) =>
      api<AdminNameDecisionResult>(`/admin/name-requests/${id}/decide`, {
        method: "POST",
        body,
      }),
    onSuccess: (r) => refresh(r.ok),
  });
}

export function useDecideRecordRequest(id: string) {
  const refresh = useRefreshAfterDecision();
  return useMutation({
    mutationFn: (body: AdminRecordDecisionBody) =>
      api<AdminRecordDecisionResult>(`/admin/record-requests/${id}/decide`, {
        method: "POST",
        body,
      }),
    onSuccess: (r) => refresh(r.ok),
  });
}
