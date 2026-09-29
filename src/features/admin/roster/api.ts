import type {
  AdminRoster,
  RosterDeleteResult,
  RosterImportResult,
} from "@contract/admin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ADMIN_KEY } from "../api";

export const ADMIN_ROSTER_KEY = ["admin", "roster"] as const;

export function useAdminRoster() {
  return useQuery({
    queryKey: ADMIN_ROSTER_KEY,
    queryFn: ({ signal }) => api<AdminRoster>("/admin/roster", { signal }),
  });
}

/** A picked CSV: a web File, or a native file URI. */
export type RosterFile =
  | { file: File }
  | { uri: string; name: string; mimeType?: string };

export function useRosterImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      intent: "preview" | "import";
      file: RosterFile | null;
      csv: string;
    }) => {
      const form = new FormData();
      form.append("intent", input.intent);
      if (input.file && "file" in input.file)
        form.append("file", input.file.file);
      else if (input.file)
        // React Native's FormData uploads a file from its URI.
        form.append("file", {
          uri: input.file.uri,
          name: input.file.name,
          type: input.file.mimeType ?? "text/csv",
        } as unknown as Blob);
      else form.append("csv", input.csv);
      return api<RosterImportResult>("/admin/roster/import", {
        method: "POST",
        body: form,
      });
    },
    onSuccess: (r) => {
      if (r.mode === "import" && r.ok)
        void queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    },
  });
}

export function useRosterDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirm: boolean) =>
      api<RosterDeleteResult>("/admin/roster", {
        method: "DELETE",
        body: { confirm },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    },
  });
}
