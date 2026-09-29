import type { AdminHome } from "@contract/admin";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** 管理モード data; keys start with "admin". */
export const ADMIN_KEY = ["admin"] as const;
export const ADMIN_HOME_KEY = ["admin", "home"] as const;

export function useAdminHome() {
  return useQuery({
    queryKey: ADMIN_HOME_KEY,
    queryFn: ({ signal }) => api<AdminHome>("/admin", { signal }),
  });
}
