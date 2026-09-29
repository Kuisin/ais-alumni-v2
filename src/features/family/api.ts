import type {
  FamilyClaimResult,
  FamilyPage,
  FamilySearch,
  InviteCreated,
  InviteKind,
  InvitesPage,
  InviteType,
  VouchAnswer,
  VouchPage,
} from "@contract/family";
import type { Ok } from "@contract/people";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";

/**
 * 家族, 招待 and vouch data. Keys: ["family"], ["family", "search", …],
 * ["invites"], ["vouch", id]. Family and vouch changes also refresh Home
 * (its 「対応が必要な項目」) and the account badges.
 */

export const familyKeys = {
  family: ["family"] as const,
  search: (direction: string, q: string) =>
    ["family", "search", direction, q] as const,
  invites: ["invites"] as const,
  vouch: (id: string) => ["vouch", id] as const,
};

const enc = encodeURIComponent;

/** The server's error code (a messages key suffix), or a generic one. */
export function errorCode(
  e: unknown,
  known: readonly string[],
  fallback: string,
) {
  return e instanceof ApiError && known.includes(e.code) ? e.code : fallback;
}

// ---- 家族 ----

export function useFamily() {
  return useQuery({
    queryKey: familyKeys.family,
    queryFn: ({ signal }) => api<FamilyPage>("/family", { signal }),
  });
}

export function useFamilySearch(direction: "child" | "parent", q: string) {
  return useQuery({
    queryKey: familyKeys.search(direction, q),
    queryFn: ({ signal }) =>
      api<FamilySearch>(`/family/search?direction=${direction}&q=${enc(q)}`, {
        signal,
      }),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
  });
}

function useFamilyRefresh() {
  const queryClient = useQueryClient();
  return async () => {
    void queryClient.invalidateQueries({ queryKey: ME_KEY });
    void queryClient.invalidateQueries({ queryKey: ["home"] });
    await queryClient.invalidateQueries({ queryKey: familyKeys.family });
  };
}

export function useClaimFamily() {
  const refresh = useFamilyRefresh();
  return useMutation({
    mutationFn: (body: { direction: "child" | "parent"; otherId: string }) =>
      api<FamilyClaimResult>("/family/links", { body }),
    onSuccess: refresh,
  });
}

export function useClaimChildByName() {
  const refresh = useFamilyRefresh();
  return useMutation({
    mutationFn: (body: {
      childName: string;
      cohortNumber: string;
      leftYear: string;
    }) => api<FamilyClaimResult>("/family/children", { body }),
    onSuccess: refresh,
  });
}

export function useConfirmLink() {
  const refresh = useFamilyRefresh();
  return useMutation({
    mutationFn: (linkId: string) =>
      api<Ok>(`/family/links/${enc(linkId)}/confirm`, { method: "POST" }),
    onSettled: refresh,
  });
}

export function useRemoveLink() {
  const refresh = useFamilyRefresh();
  return useMutation({
    mutationFn: (linkId: string) =>
      api<Ok>(`/family/links/${enc(linkId)}`, { method: "DELETE" }),
    onSettled: refresh,
  });
}

export function useStartHandover(childId: string) {
  const refresh = useFamilyRefresh();
  return useMutation({
    mutationFn: (email: string) =>
      api<Ok>(`/family/managed/${enc(childId)}/handover`, {
        body: { email },
      }),
    onSuccess: refresh,
  });
}

export function useCancelHandover(childId: string) {
  const refresh = useFamilyRefresh();
  return useMutation({
    mutationFn: () =>
      api<Ok>(`/family/managed/${enc(childId)}/handover`, {
        method: "DELETE",
      }),
    onSettled: refresh,
  });
}

// ---- 招待 ----

export function useInvites() {
  return useQuery({
    queryKey: familyKeys.invites,
    queryFn: ({ signal }) => api<InvitesPage>("/invites", { signal }),
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      kind: InviteKind;
      type: InviteType;
      cohortNumber: string;
      inviteeName: string;
    }) => api<InviteCreated>("/invites", { body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: familyKeys.invites }),
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<Ok>(`/invites/${enc(id)}/revoke`, { method: "POST" }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: familyKeys.invites }),
  });
}

// ---- この方をご存じですか？ ----

export function useVouch(id: string) {
  return useQuery({
    queryKey: familyKeys.vouch(id),
    queryFn: ({ signal }) => api<VouchPage>(`/vouch/${enc(id)}`, { signal }),
  });
}

export function useAnswerVouch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answer: VouchAnswer) =>
      api<Ok>(`/vouch/${enc(id)}`, { body: { answer } }),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      await queryClient.invalidateQueries({ queryKey: familyKeys.vouch(id) });
    },
  });
}
