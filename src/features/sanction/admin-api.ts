import type {
  AdminSanctionApply,
  AdminSanctions,
} from "@contract/admin-members";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_HOME_KEY } from "@/features/admin/api";
import { api } from "@/lib/api";

/** 管理モード → 会員詳細 → 処分 (src/server/lib/sanctions.ts). */

export const sanctionsKey = (memberId: string) =>
  ["admin", "members", memberId, "sanctions"] as const;

export function useMemberSanctions(memberId: string) {
  return useQuery({
    queryKey: sanctionsKey(memberId),
    queryFn: ({ signal }) =>
      api<AdminSanctions>(
        `/admin/members/${encodeURIComponent(memberId)}/sanctions`,
        { signal },
      ),
  });
}

function useSanctionMutation<V>(
  memberId: string,
  send: (v: V) => Promise<AdminSanctions>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: async (data) => {
      queryClient.setQueryData(sanctionsKey(memberId), data);
      await Promise.all([
        // The member page's 操作ログ shows the new entry.
        queryClient.invalidateQueries({
          queryKey: ["admin", "members", memberId],
        }),
        queryClient.invalidateQueries({ queryKey: ADMIN_HOME_KEY }),
      ]);
    },
  });
}

export const useApplySanction = (memberId: string) =>
  useSanctionMutation<AdminSanctionApply>(memberId, (body) =>
    api(`/admin/members/${encodeURIComponent(memberId)}/sanctions`, { body }),
  );

export const useLiftSanction = (memberId: string) =>
  useSanctionMutation<string>(memberId, (sanctionId) =>
    api(`/admin/sanctions/${encodeURIComponent(sanctionId)}/lift`, {
      method: "POST",
    }),
  );
