import type {
  AdminBroadcast,
  AdminNotifyPage,
  BroadcastEditResult,
  BroadcastManageOk,
  BroadcastRequest,
  BroadcastResult,
} from "@contract/admin-notify";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * 一斉通知 (admin mode): the send page (form options + history) and one sent
 * message. Keys: ["admin", "notify", "page", all] and ["admin", "notify", id].
 */

export const notifyKeys = {
  all: ["admin", "notify"] as const,
  page: (all: boolean) => ["admin", "notify", "page", all] as const,
  detail: (id: string) => ["admin", "notify", id] as const,
};

const path = (id: string, rest = "") =>
  `/admin/notify/${encodeURIComponent(id)}${rest}`;

export function useNotifyPage(all: boolean) {
  return useQuery({
    queryKey: notifyKeys.page(all),
    queryFn: ({ signal }) =>
      api<AdminNotifyPage>(`/admin/notify${all ? "?all=1" : ""}`, { signal }),
    // Switching the history tab keeps the page (and the form being written).
    placeholderData: keepPreviousData,
  });
}

/** Preview or send (the website's two-step form). */
export function useBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BroadcastRequest) =>
      api<BroadcastResult>("/admin/notify", { body }),
    onSuccess: (result) => {
      if (result.step === "sent")
        void queryClient.invalidateQueries({ queryKey: notifyKeys.all });
    },
  });
}

export function useSentMessage(id: string) {
  return useQuery({
    queryKey: notifyKeys.detail(id),
    queryFn: ({ signal }) => api<AdminBroadcast>(path(id), { signal }),
  });
}

/** Refetch the message and the history once a change went through. */
function useManage<V, R>(id: string, send: (v: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: async () => {
      void queryClient.invalidateQueries({
        queryKey: notifyKeys.all,
        predicate: (q) => q.queryKey[2] === "page",
      });
      await queryClient.invalidateQueries({ queryKey: notifyKeys.detail(id) });
    },
  });
}

export function useEditBroadcast(id: string) {
  return useManage(id, (body: { title: string; body: string }) =>
    api<BroadcastEditResult>(path(id), { method: "PATCH", body }),
  );
}

export function useArchiveBroadcast(id: string) {
  return useManage(id, (archive: boolean) =>
    api<BroadcastManageOk>(path(id, "/archive"), { body: { archive } }),
  );
}

export function useDeleteBroadcast(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<BroadcastManageOk>(path(id), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: notifyKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: notifyKeys.all });
    },
  });
}
