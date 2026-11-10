import type {
  TestAccount,
  TestAccountCreate,
  TestAccountList,
} from "@contract/admin-members";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const TEST_ACCOUNTS_KEY = ["admin", "test-accounts"] as const;

export function useTestAccounts() {
  return useQuery({
    queryKey: TEST_ACCOUNTS_KEY,
    queryFn: ({ signal }) =>
      api<TestAccountList>("/admin/test-accounts", { signal }),
  });
}

/** Make a test account (ACTIVE; signs in with the email code). */
export function useCreateTestAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TestAccountCreate) =>
      api<TestAccount>("/admin/test-accounts", { method: "POST", body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

/** Delete a test account (the server refuses anything else). */
export function useDeleteTestAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/admin/test-accounts/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}
