import type {
  AcceptResult,
  DirectoryOptions,
  DirectoryPage,
  FollowLists,
  FollowResult,
  MemberProfile,
  Ok,
  ProfileAudience,
} from "@contract/people";
import {
  keepPreviousData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";

/**
 * People data: the directory (24 per page, cursor paging as on the
 * website), member profiles and the follow lists, plus the follow / block
 * changes. Keys: ["directory", …], ["members", id, as], ["follows", …].
 * Every change refreshes the profile, the follow lists, the directory and
 * the tab badges (ME_KEY: follow requests).
 */

export const peopleKeys = {
  directory: ["directory"] as const,
  directoryList: (query: string) => ["directory", "list", query] as const,
  directoryOptions: ["directory", "options"] as const,
  member: (id: string) => ["members", id] as const,
  follows: ["follows"] as const,
};

const enc = encodeURIComponent;

// ---- Directory ----

/** The directory form's values (strings as typed; "" = not set). */
export type DirectoryForm = {
  q: string;
  /** "" = the default (卒業生＋元在校生) */
  role: string;
  from: string;
  to: string;
  division: string;
  stage: string;
  cohort: string;
};

export const EMPTY_FORM: DirectoryForm = {
  q: "",
  role: "",
  from: "",
  to: "",
  division: "",
  stage: "",
  cohort: "",
};

/** "?q=…&role=…" as the website's directoryQuery (empty values left out). */
export function directoryQuery(
  f: DirectoryForm,
  cursor: string | null = null,
): string {
  const pairs: [string, string][] = [
    ["q", f.q.trim()],
    ["role", f.role],
    ["from", f.from.trim()],
    ["to", f.to.trim()],
    ["division", f.division],
    ["stage", f.stage],
    ["cohort", f.cohort],
    ["cursor", cursor ?? ""],
  ];
  const s = pairs
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${enc(v)}`)
    .join("&");
  return s ? `?${s}` : "";
}

export function useDirectory(form: DirectoryForm) {
  return useInfiniteQuery({
    queryKey: peopleKeys.directoryList(directoryQuery(form)),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api<DirectoryPage>(`/directory${directoryQuery(form, pageParam)}`, {
        signal,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Keep the current results on screen while new filters load.
    placeholderData: keepPreviousData,
  });
}

export function useDirectoryOptions() {
  return useQuery({
    queryKey: peopleKeys.directoryOptions,
    queryFn: ({ signal }) =>
      api<DirectoryOptions>("/directory/options", { signal }),
    staleTime: 10 * 60_000,
  });
}

// ---- Profiles ----

export function useMember(
  id: string,
  as: ProfileAudience | null,
  enabled = true,
) {
  return useQuery({
    queryKey: [...peopleKeys.member(id), as ?? ""],
    queryFn: ({ signal }) =>
      api<MemberProfile>(`/members/${enc(id)}${as ? `?as=${as}` : ""}`, {
        signal,
      }),
    enabled: enabled && Boolean(id),
  });
}

// ---- Follow lists ----

/** `accepted`: the request just accepted (follow-back offer). */
export function useFollows(accepted: string | null) {
  return useQuery({
    queryKey: [...peopleKeys.follows, accepted ?? ""],
    queryFn: ({ signal }) =>
      api<FollowLists>(
        `/follows${accepted ? `?accepted=${enc(accepted)}` : ""}`,
        {
          signal,
        },
      ),
    placeholderData: keepPreviousData,
  });
}

// ---- Changes ----

/**
 * After a follow / block change: what's on screen (profile, follow lists)
 * is awaited so buttons stay busy until it shows the new state; the rest
 * refreshes in the background.
 */
async function refreshAfterChange(
  queryClient: QueryClient,
  memberId: string | null,
  also: readonly (readonly string[])[] = [],
): Promise<void> {
  void queryClient.invalidateQueries({ queryKey: ME_KEY });
  void queryClient.invalidateQueries({ queryKey: peopleKeys.directory });
  for (const key of also) void queryClient.invalidateQueries({ queryKey: key });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: peopleKeys.follows }),
    memberId
      ? queryClient.invalidateQueries({ queryKey: peopleKeys.member(memberId) })
      : null,
  ]);
}

/** 「フォローする」 / 「フォローバック」. */
export function useFollowMember(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<FollowResult>(`/members/${enc(memberId)}/follow`, {
        method: "POST",
      }),
    onSuccess: () => refreshAfterChange(queryClient, memberId, [["home"]]),
    // Refused: the state may have changed meanwhile (e.g. they blocked me).
    onError: () => refreshAfterChange(queryClient, memberId),
  });
}

/** Unfollow, or cancel my pending request. */
export function useUnfollowMember(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<Ok>(`/members/${enc(memberId)}/follow`, { method: "DELETE" }),
    onSettled: () => refreshAfterChange(queryClient, memberId, [["home"]]),
  });
}

/** Block (the screen then leaves the profile) / unblock. */
export function useBlockMember(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (block: boolean) =>
      api<Ok>(`/members/${enc(memberId)}/block`, {
        method: block ? "POST" : "DELETE",
      }),
    onSuccess: (_, block) => {
      // Their profile is hidden from me now: don't keep (or refetch) it.
      if (block)
        queryClient.removeQueries({ queryKey: peopleKeys.member(memberId) });
      return refreshAfterChange(queryClient, block ? null : memberId, [
        ["chat"],
        ["home"],
      ]);
    },
    onError: () => refreshAfterChange(queryClient, memberId),
  });
}

/** 「承認」 / 「拒否」 on a request to me. */
export function useAnswerRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      followId,
      accept,
    }: {
      followId: string;
      accept: boolean;
    }) =>
      accept
        ? api<AcceptResult>(`/follows/requests/${enc(followId)}/accept`, {
            method: "POST",
          })
        : api<Ok>(`/follows/requests/${enc(followId)}/decline`, {
            method: "POST",
          }).then(() => ({ accepted: false })),
    onSettled: () => refreshAfterChange(queryClient, null, [["home"]]),
  });
}

/** 「削除」: remove one of my followers. */
export function useRemoveFollower(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<Ok>(`/follows/followers/${enc(memberId)}`, { method: "DELETE" }),
    onSettled: () => refreshAfterChange(queryClient, memberId),
  });
}

// ---- Error messages ----

/** Codes with a message in the website's follows.errors.*. */
const FOLLOW_ERRORS = new Set([
  "self",
  "inactive",
  "blocked",
  "minor",
  "already",
  "family",
  "rateLimited",
  "notFound",
]);

/** The follows.errors key for a refused follow, or null (generic error). */
export function followErrorKey(e: unknown): string | null {
  return e instanceof ApiError && FOLLOW_ERRORS.has(e.code)
    ? `errors.${e.code}`
    : null;
}

/** Codes of POST /chat/direct with a message in chat.new.errors.*. */
export const CHAT_ERRORS = new Set([
  "disabled",
  "self",
  "notFound",
  "notFriends",
  "blocked",
  "forbidden",
  "restricted",
]);

/** No response at all (offline). */
export function isNetworkError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 0;
}
