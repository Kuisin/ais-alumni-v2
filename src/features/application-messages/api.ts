import type {
  ApplicationAttachmentUploaded,
  ApplicationReplySent,
  ApplicationThread,
  ApplicationThreads,
} from "@contract/onboarding";
import type { Ok } from "@contract/people";
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { familyKeys } from "@/features/family/api";
import { ONBOARDING_KEY } from "@/features/onboarding/api";
import { api } from "@/lib/api";
import { appendPicked, type PickedFile } from "@/lib/upload-image";
import type { AttachConfig, PendingAttachment } from "./attachments";

/**
 * 「やりとり」 with the committee about an application: the applicant's own
 * and those of child accounts the parent manages. Keys:
 * ["onboarding", "messages", …]. Replying or reading also refreshes 家族
 * (its unread dot); the screens refresh /me when a reply put an
 * application back in review.
 */
export const messageKeys = {
  all: [...ONBOARDING_KEY, "messages"] as const,
  list: [...ONBOARDING_KEY, "messages", "list"] as const,
  thread: (id: string) =>
    [...ONBOARDING_KEY, "messages", "thread", id] as const,
};

const enc = encodeURIComponent;

export function useApplicationThreads() {
  return useQuery({
    queryKey: messageKeys.list,
    queryFn: ({ signal }) =>
      api<ApplicationThreads>("/onboarding/messages", { signal }),
  });
}

export function useApplicationThread(id: string) {
  return useQuery({
    queryKey: messageKeys.thread(id),
    queryFn: ({ signal }) =>
      api<ApplicationThread>(`/onboarding/messages/${enc(id)}`, { signal }),
  });
}

function refresh(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: messageKeys.all }),
    queryClient.invalidateQueries({ queryKey: familyKeys.family }),
  ]);
}

export type ReplyInput = {
  body: string;
  attachments?: { key: string; fileName: string }[];
};

export function useReplyToThread(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, attachments }: ReplyInput) =>
      api<ApplicationReplySent>(`/onboarding/messages/${enc(id)}`, {
        body: attachments?.length ? { body, attachments } : { body },
      }),
    onSuccess: (sent) =>
      queryClient.setQueryData(messageKeys.thread(id), sent.thread),
    onSettled: () => refresh(queryClient),
  });
}

/** The thread is on screen: its committee messages are read. */
export function useMarkThreadRead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<Ok>(`/onboarding/messages/${enc(id)}/read`, { body: {} }),
    onSuccess: () => refresh(queryClient),
  });
}

/**
 * Upload one file to a multipart endpoint that answers { item }; an
 * answer without one (e.g. the demo) counts as a failure.
 */
export async function uploadAttachmentTo(
  path: string,
  f: PickedFile,
): Promise<PendingAttachment> {
  const fd = new FormData();
  appendPicked(fd, "file", f);
  const r = await api<ApplicationAttachmentUploaded>(path, { body: fd });
  if (!r?.item) throw new Error("generic");
  return r.item;
}

/** Attachments for a reply in this thread. */
export function threadAttachments(id: string): AttachConfig {
  const path = `/onboarding/messages/${enc(id)}/attachments`;
  return {
    upload: (f) => uploadAttachmentTo(path, f),
    discard: (key) => {
      void api(`${path}?key=${enc(key)}`, { method: "DELETE" }).catch(() => {});
    },
  };
}
