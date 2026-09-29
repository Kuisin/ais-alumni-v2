import type { AdminTeachers } from "@contract/admin";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";

export const ADMIN_TEACHERS_KEY = ["admin", "teachers"] as const;

export function useAdminTeachers(q: string) {
  return useQuery({
    queryKey: [...ADMIN_TEACHERS_KEY, q],
    queryFn: ({ signal }) =>
      api<AdminTeachers>(
        `/admin/teachers${q ? `?q=${encodeURIComponent(q)}` : ""}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
}

/** Make a member a current teacher, or move one to former. */
export function useSetTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, current }: { userId: string; current: boolean }) =>
      api<{ ok: true }>(`/admin/teachers/${encodeURIComponent(userId)}`, {
        method: current ? "PUT" : "DELETE",
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ADMIN_TEACHERS_KEY }),
  });
}
