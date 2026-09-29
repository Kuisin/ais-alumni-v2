import type {
  VerificationActionResult,
  VerificationDecision,
  VerificationDetail,
  VerificationQueue,
  VerificationTab,
  VoucherCandidate,
} from "@contract/admin";
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ADMIN_KEY } from "@/features/admin/api";
import { api } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";

/**
 * 本人確認 (the website's /app/admin/verification): the queue, one
 * application, the voucher search and the decisions. Keys:
 * ["admin", "verification", …]. A change refreshes all of 管理モード (the
 * home's badges) and ME_KEY.
 */
export const verificationKeys = {
  all: ["admin", "verification"] as const,
  queue: (tab: VerificationTab, q: string, page: number) =>
    ["admin", "verification", "queue", tab, q, page] as const,
  detail: (id: string) => ["admin", "verification", "detail", id] as const,
  vouchers: (id: string, q: string) =>
    ["admin", "verification", "vouchers", id, q] as const,
};

const enc = encodeURIComponent;

export function useVerificationQueue(
  tab: VerificationTab,
  q: string,
  page: number,
) {
  return useQuery({
    queryKey: verificationKeys.queue(tab, q, page),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (tab !== "pending") params.set("tab", tab);
      if (q) params.set("q", q);
      if (page > 1) params.set("page", String(page));
      const qs = params.toString();
      return api<VerificationQueue>(
        `/admin/verification${qs ? `?${qs}` : ""}`,
        { signal },
      );
    },
    placeholderData: keepPreviousData,
  });
}

export function useVerificationDetail(id: string) {
  return useQuery({
    queryKey: verificationKeys.detail(id),
    queryFn: ({ signal }) =>
      api<VerificationDetail>(`/admin/verification/${enc(id)}`, { signal }),
  });
}

export function useVoucherCandidates(id: string, q: string) {
  return useQuery({
    queryKey: verificationKeys.vouchers(id, q),
    queryFn: ({ signal }) =>
      api<VoucherCandidate[]>(
        `/admin/verification/${enc(id)}/vouchers?q=${enc(q)}`,
        { signal },
      ),
    enabled: q.length > 0,
  });
}

function refresh(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
    queryClient.invalidateQueries({ queryKey: ME_KEY }),
  ]);
}

export function useDecideVerification(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { decision: VerificationDecision; note: string }) =>
      api<VerificationActionResult>(`/admin/verification/${enc(id)}/decision`, {
        body,
      }),
    onSettled: () => refresh(queryClient),
  });
}

export function useAddVoucher(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (voucherId: string) =>
      api<VerificationActionResult>(`/admin/verification/${enc(id)}/vouchers`, {
        body: { voucherId },
      }),
    onSettled: () => refresh(queryClient),
  });
}

export function useMergeManaged(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (managedId: string) =>
      api<{ ok: true }>(`/admin/verification/${enc(id)}/merge`, {
        body: { managedId },
      }),
    onSettled: () => refresh(queryClient),
  });
}
