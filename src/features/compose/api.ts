import type {
  AttachmentItem,
  AudienceCount,
  AudienceMember,
  AudienceSpec,
  ComposeFileResult,
  ComposeOptions,
  ComposeSaved,
} from "@contract/compose";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";

/**
 * Writing ニュース / イベント: the form options, saving (multipart, like the
 * website's forms), attachment uploads, and the audience picker's live
 * count and member search. Keys: ["compose", …].
 */

export function useComposeOptions() {
  return useQuery({
    queryKey: ["compose", "options"],
    queryFn: ({ signal }) => api<ComposeOptions>("/compose", { signal }),
    staleTime: 5 * 60 * 1000,
  });
}

/** A picked file as React Native's FormData takes it (web: a Blob). */
export type PickedFile = {
  uri: string;
  name: string;
  type: string;
  size?: number;
  /** web only */
  file?: Blob;
};

export function appendFile(fd: FormData, field: string, f: PickedFile): void {
  if (f.file) fd.append(field, f.file, f.name);
  // React Native's FormData uploads { uri, name, type } objects.
  else fd.append(field, { uri: f.uri, name: f.name, type: f.type } as never);
}

/** Field errors from a refused save (adminContent.errors keys). */
export type SaveError = { error: string; fieldErrors: Record<string, string> };

export function saveError(e: unknown): SaveError {
  if (e instanceof ApiError) {
    const fields = e.body?.fieldErrors;
    return {
      error: e.status === 0 ? "network" : e.code,
      fieldErrors:
        fields && typeof fields === "object"
          ? (fields as Record<string, string>)
          : {},
    };
  }
  return { error: "generic", fieldErrors: {} };
}

/** POST /compose/news or /compose/events; lists and Home follow. */
export function useSaveCompose(kind: "news" | "events") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fd: FormData) =>
      api<ComposeSaved>(`/compose/${kind}`, { method: "POST", body: fd }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: [kind] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      if (kind === "news")
        void queryClient.invalidateQueries({ queryKey: ["news", saved.id] });
    },
  });
}

/** Upload one attachment; the error code is adminContent.hub.files.errors.* */
export async function uploadAttachment(f: PickedFile): Promise<AttachmentItem> {
  const fd = new FormData();
  appendFile(fd, "file", f);
  const r = await api<ComposeFileResult>("/compose/files", {
    method: "POST",
    body: fd,
  });
  return r.item;
}

/** Live recipient count (debounced 300 ms; stale answers ignored). */
export function useAudienceCount(spec: AudienceSpec): number | null | "error" {
  const json = JSON.stringify(spec);
  const [count, setCount] = useState<number | null | "error">(null);
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    setCount(null);
    const timer = setTimeout(async () => {
      try {
        const r = await api<AudienceCount>("/compose/audience", {
          body: JSON.parse(json),
        });
        if (n === seq.current) setCount(r.count);
      } catch {
        if (n === seq.current) setCount("error");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [json]);
  return count;
}

/** Members by name while typing (debounced 250 ms). */
export function useMemberSearch(q: string): {
  results: AudienceMember[] | null;
  searching: boolean;
} {
  const [results, setResults] = useState<AudienceMember[] | null>(null);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    const n = ++seq.current;
    if (!term) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api<{ members: AudienceMember[] }>(
          `/compose/members?q=${encodeURIComponent(term)}`,
        );
        if (n === seq.current) setResults(r.members);
      } catch {
        if (n === seq.current) setResults([]);
      } finally {
        if (n === seq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  return { results, searching };
}
