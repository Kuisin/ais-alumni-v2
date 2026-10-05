import type {
  AdminFamilyAdd,
  AdminFamilyCandidate,
  AdminFamilyResult,
  AdminMemberDetail,
  AdminMemberList,
  AdminMergeRequest,
  AdminMergeResult,
  AdminPositionUpdate,
  AdminProfileUpdate,
  AdminResult,
  AdminRightsUpdate,
  AdminRoleUpdate,
  AdminStateUpdate,
} from "@contract/admin-members";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ADMIN_HOME_KEY } from "@/features/admin/api";
import { api } from "@/lib/api";

/** 管理モード → 会員 (GET /admin/members, /admin/members/[id], forms). */
export const MEMBERS_KEY = ["admin", "members"] as const;

export type MemberFilters = {
  q: string;
  state: string;
  role: string;
  line: string;
  /** "" | "any" | "ios" | "android" | "none" — the native app */
  app: string;
  admin: boolean;
};

export const NO_FILTERS: MemberFilters = {
  q: "",
  state: "",
  role: "",
  line: "",
  app: "",
  admin: false,
};

export function useAdminMembers(f: MemberFilters) {
  return useInfiniteQuery({
    queryKey: [...MEMBERS_KEY, "list", f],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const p = new URLSearchParams();
      if (f.q.trim()) p.set("q", f.q.trim());
      if (f.state) p.set("state", f.state);
      if (f.role) p.set("role", f.role);
      if (f.line) p.set("line", f.line);
      if (f.app) p.set("app", f.app);
      if (f.admin) p.set("admin", "1");
      if (pageParam) p.set("cursor", pageParam);
      const qs = p.toString();
      return api<AdminMemberList>(`/admin/members${qs ? `?${qs}` : ""}`, {
        signal,
      });
    },
    getNextPageParam: (last) => last.nextCursor,
    // Keep the list (and the filter choices) while new filters load.
    placeholderData: keepPreviousData,
  });
}

export const memberKey = (id: string) => [...MEMBERS_KEY, id] as const;

export function useAdminMember(id: string) {
  return useQuery({
    queryKey: memberKey(id),
    queryFn: ({ signal }) =>
      api<AdminMemberDetail>(`/admin/members/${encodeURIComponent(id)}`, {
        signal,
      }),
  });
}

/**
 * A form on the member page: posts, then refreshes the member (and the
 * list) when the action went through.
 */
function useMemberMutation<B, R extends { ok?: boolean }>(
  id: string,
  send: (base: string, body: B) => Promise<R>,
) {
  const queryClient = useQueryClient();
  const base = `/admin/members/${encodeURIComponent(id)}`;
  return useMutation({
    mutationFn: (body: B) => send(base, body),
    onSuccess: async (r) => {
      if (!r.ok) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
        queryClient.invalidateQueries({ queryKey: ADMIN_HOME_KEY }),
      ]);
    },
  });
}

export const useSaveProfile = (id: string) =>
  useMemberMutation<AdminProfileUpdate, AdminResult>(id, (base, body) =>
    api(`${base}/profile`, { body }),
  );

export const useSaveRole = (id: string) =>
  useMemberMutation<AdminRoleUpdate, AdminResult>(id, (base, body) =>
    api(`${base}/roles`, { body }),
  );

export const useRemoveRole = (id: string) =>
  useMemberMutation<string, AdminResult>(id, (base, role) =>
    api(`${base}/roles/${role}`, { method: "DELETE" }),
  );

export const useSetState = (id: string) =>
  useMemberMutation<AdminStateUpdate, AdminResult>(id, (base, body) =>
    api(`${base}/state`, { body }),
  );

export const useSetAdmin = (id: string) =>
  useMemberMutation<AdminRightsUpdate, AdminResult>(id, (base, body) =>
    api(`${base}/admin`, { body }),
  );

export const useSetPosition = (id: string) =>
  useMemberMutation<AdminPositionUpdate, { ok: boolean; message?: string }>(
    id,
    (base, body) => api(`${base}/positions`, { body }),
  );

export const useAddFamily = (id: string) =>
  useMemberMutation<AdminFamilyAdd, AdminFamilyResult>(id, (base, body) =>
    api(`${base}/family`, { body }),
  );

export const useConfirmFamily = (id: string) =>
  useMemberMutation<string, AdminFamilyResult>(id, (base, linkId) =>
    api(`${base}/family/${linkId}/confirm`, { method: "POST" }),
  );

export const useRemoveFamily = (id: string) =>
  useMemberMutation<string, AdminFamilyResult>(id, (base, linkId) =>
    api(`${base}/family/${linkId}`, { method: "DELETE" }),
  );

export function useFamilyCandidates(
  id: string,
  as: "parent" | "child",
  q: string,
) {
  const term = q.trim();
  return useQuery({
    queryKey: [...memberKey(id), "family", as, term],
    enabled: term.length > 0,
    queryFn: ({ signal }) =>
      api<AdminFamilyCandidate[]>(
        `/admin/members/${encodeURIComponent(id)}/family/candidates?as=${as}&q=${encodeURIComponent(term)}`,
        { signal },
      ),
  });
}

export const useMerge = (id: string) =>
  useMemberMutation<AdminMergeRequest, AdminMergeResult>(id, (base, body) =>
    api(`${base}/merge`, { body }),
  );
