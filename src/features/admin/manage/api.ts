import type {
  AdminAudit,
  AdminChat,
  AdminChatRulesInput,
  AdminCohortInput,
  AdminCohortRep,
  AdminCohorts,
  AdminDestinations,
  AdminFormResult,
  AdminLine,
  AdminOrgMergeInput,
  AdminOrgRenameInput,
  AdminOrgs,
  AdminStats,
  AdminSupport,
  LineAnnounceInput,
  LineAnnouncePreview,
  LineAnnounceSent,
  OrgKind,
  RichMenuResult,
} from "@contract/admin-manage";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ADMIN_HOME_KEY } from "../api";

/**
 * 管理モード's committee pages (contract: src/contract/admin-manage.ts):
 * 学年, 学校・会社, 進路, 統計, 監査ログ, お問い合わせ, チャット, LINE.
 * Keys: ["admin", <page>, …].
 */

const qs = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();
  return s ? `?${s}` : "";
};

export const COHORTS_KEY = ["admin", "cohorts"] as const;

export function useAdminCohorts() {
  return useQuery({
    queryKey: COHORTS_KEY,
    queryFn: ({ signal }) => api<AdminCohorts>("/admin/cohorts", { signal }),
  });
}

export function useCohortStudents(cohortId: string, q: string) {
  return useQuery({
    queryKey: ["admin", "cohorts", cohortId, "students", q],
    enabled: q.length > 0,
    queryFn: ({ signal }) =>
      api<AdminCohortRep[]>(`/admin/cohorts/${cohortId}/students${qs({ q })}`, {
        signal,
      }),
  });
}

export type OrgParams = { kind: OrgKind; sort: "name" | "count"; q: string };

export function useAdminOrgs(p: OrgParams, enabled = true) {
  return useQuery({
    queryKey: ["admin", "organizations", p],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api<AdminOrgs>(
        `/admin/organizations${qs({ kind: p.kind, sort: p.sort === "count" ? "count" : undefined, q: p.q })}`,
        { signal },
      ),
  });
}

export type DestinationParams = {
  cohort: string;
  /** null until the filter is changed (the server's default) */
  hist: boolean | null;
  all: boolean;
};

export function useAdminDestinations(p: DestinationParams) {
  return useQuery({
    queryKey: ["admin", "destinations", p],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api<AdminDestinations>(
        `/admin/destinations${qs({
          cohort: p.cohort,
          f: p.hist === null ? undefined : "1",
          hist: p.hist ? "1" : undefined,
          all: p.all ? "1" : undefined,
        })}`,
        { signal },
      ),
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: ({ signal }) => api<AdminStats>("/admin/stats", { signal }),
  });
}

export function useAdminAudit(action: string, target: string) {
  return useInfiniteQuery({
    queryKey: ["admin", "audit", action, target],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api<AdminAudit>(
        `/admin/audit${qs({ action, target, cursor: pageParam ?? undefined })}`,
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export type InboxTab = "open" | "closed";

export function useAdminSupport(tab: InboxTab) {
  return useQuery({
    queryKey: ["admin", "support", tab],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api<AdminSupport>(`/admin/support${qs({ tab })}`, { signal }),
  });
}

export function useAdminChat(tab: InboxTab) {
  return useQuery({
    queryKey: ["admin", "chat", tab],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      api<AdminChat>(`/admin/chat${qs({ tab })}`, { signal }),
  });
}

export function useAdminLine() {
  return useQuery({
    queryKey: ["admin", "line"],
    queryFn: ({ signal }) => api<AdminLine>("/admin/line", { signal }),
  });
}

export const adminManageApi = {
  saveCohort: (id: string, body: AdminCohortInput) =>
    api<AdminFormResult>(`/admin/cohorts/${id}`, { method: "PUT", body }),
  deleteCohort: (id: string) =>
    api<{ ok: boolean }>(`/admin/cohorts/${id}`, { method: "DELETE" }),
  setCohortRep: (id: string, userId: string, on: boolean) =>
    api<AdminFormResult>(`/admin/cohorts/${id}/reps`, {
      body: { userId, on },
    }),
  renameOrg: (body: AdminOrgRenameInput) =>
    api<AdminFormResult>("/admin/organizations/rename", { body }),
  mergeOrg: (body: AdminOrgMergeInput) =>
    api<AdminFormResult>("/admin/organizations/merge", { body }),
  deleteOrg: (kind: OrgKind, id: string) =>
    api<{ ok: boolean }>("/admin/organizations/delete", { body: { kind, id } }),
  setSupportClosed: (id: string, close: boolean) =>
    api<{ ok: boolean }>(`/admin/support/${id}`, { body: { close } }),
  setChatReportClosed: (id: string, close: boolean) =>
    api<{ ok: boolean }>(`/admin/chat/reports/${id}`, { body: { close } }),
  saveChatRules: (body: AdminChatRulesInput) =>
    api<{ ok?: boolean; error?: boolean }>("/admin/chat/rules", {
      method: "PUT",
      body,
    }),
  previewLineAnnouncement: (text: string, textEn?: string) =>
    api<LineAnnouncePreview>("/admin/line/announce", {
      body: { intent: "preview", text, textEn } satisfies LineAnnounceInput,
    }),
  sendLineAnnouncement: (text: string, textEn?: string) =>
    api<LineAnnounceSent>("/admin/line/announce", {
      body: { intent: "send", text, textEn } satisfies LineAnnounceInput,
    }),
  installRichMenu: () =>
    api<RichMenuResult>("/admin/line/richmenu", { method: "POST", body: {} }),
};

/** Refetch a page's data (and the admin home's badges). */
export function useRefreshAdmin() {
  const queryClient = useQueryClient();
  return (page: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", page] }),
      queryClient.invalidateQueries({ queryKey: ADMIN_HOME_KEY }),
    ]);
}
