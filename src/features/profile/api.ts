import type { PersonalField } from "@contract/account";
import type {
  AboutUpdate,
  BirthDateRequestInput,
  FormError,
  FormOk,
  GenderRequestInput,
  HistoryEditor,
  HistoryInput,
  NameRequestInput,
  OrgSearch,
  RecordPage,
  RecordRequestInput,
} from "@contract/profile";
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { PROFILE_KEY } from "@/features/me/api";
import { api, isApiError } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";

/**
 * Editing my profile (/profile/…, src/contract/profile.ts). Every change
 * refreshes マイページ (["profile"]), the account (ME_KEY: name, photo) and
 * how others see me (["members"]).
 */

export const HISTORY_KEY = ["profile", "history"] as const;
export const RECORD_KEY = ["profile", "record"] as const;

const enc = encodeURIComponent;
type Ok = { ok: true };

export const profileApi = {
  about: (body: AboutUpdate) =>
    api<FormOk>("/profile/about", { method: "PUT", body }),
  directory: (listed: boolean) =>
    api<FormOk>("/profile/directory", { method: "PUT", body: { listed } }),
  photoVisibility: (isPublic: boolean) =>
    api<FormOk>("/profile/photo/visibility", {
      method: "PUT",
      body: { public: isPublic },
    }),
  uploadPhoto: (body: FormData) =>
    api<FormOk>("/profile/photo", { method: "POST", body }),
  removePhoto: () => api<Ok>("/profile/photo", { method: "DELETE" }),
  followerFields: (shared: PersonalField[]) =>
    api<FormOk>("/profile/follower-fields", {
      method: "PUT",
      body: { shared },
    }),
  searchOrgs: (kind: "school" | "company", q: string, signal?: AbortSignal) =>
    api<OrgSearch>(`/profile/orgs?kind=${kind}&q=${enc(q)}`, { signal }),
  recordRequest: (body: RecordRequestInput) =>
    api<FormOk>("/profile/record", { method: "POST", body }),
  withdrawRecord: (id: string) =>
    api<Ok>(`/profile/record/${enc(id)}`, { method: "DELETE" }),
  nameRequest: (body: NameRequestInput) =>
    api<FormOk>("/profile/name-request", { method: "POST", body }),
  birthDateRequest: (body: BirthDateRequestInput) =>
    api<FormOk>("/profile/birth-date-request", { method: "POST", body }),
  genderRequest: (body: GenderRequestInput) =>
    api<FormOk>("/profile/gender-request", { method: "POST", body }),
  setGender: (gender: string) =>
    api<FormOk>("/profile/gender", { method: "POST", body: { gender } }),
  withdraw: (kind: "name" | "birth-date" | "gender", id: string) =>
    api<Ok>(`/profile/${kind}-request/${enc(id)}`, { method: "DELETE" }),
};

/**
 * 学歴・職歴: my own (/profile/history), or with `userId` another member's
 * for admins (管理 → 会員: /admin/members/{id}/history, same shapes).
 */
export function historyApi(userId?: string) {
  const base = userId
    ? `/admin/members/${enc(userId)}/history`
    : "/profile/history";
  return {
    key: userId
      ? (["admin", "members", userId, "history"] as const)
      : HISTORY_KEY,
    load: (signal?: AbortSignal) => api<HistoryEditor>(base, { signal }),
    save: (body: HistoryInput) => api<FormOk>(base, { method: "POST", body }),
    remove: (kind: "education" | "work", id: string) =>
      api<Ok>(`${base}/${kind}/${enc(id)}`, { method: "DELETE" }),
  };
}

export function useHistoryEditor(userId?: string) {
  const h = historyApi(userId);
  return useQuery({
    queryKey: h.key,
    queryFn: ({ signal }) => h.load(signal),
  });
}

export function useRecordPage() {
  return useQuery({
    queryKey: RECORD_KEY,
    queryFn: ({ signal }) => api<RecordPage>("/profile/record", { signal }),
  });
}

/** After any change: my profile, its sub-pages, the account, others' view. */
export function refreshProfile(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
    queryClient.invalidateQueries({ queryKey: ME_KEY }),
    queryClient.invalidateQueries({ queryKey: ["members"] }),
  ]);
}

/** A form's rejection (FormError), or null for other failures. */
export function formErrorOf(e: unknown): FormError | null {
  if (!isApiError(e, "form") || !e.body) return null;
  const b = e.body as Partial<FormError>;
  return {
    error: "form",
    message: typeof b.message === "string" ? b.message : "errors.validation",
    fieldErrors: b.fieldErrors ?? undefined,
  };
}

export type FormStatus =
  | { ok: true; message: string }
  /** error null: not a form rejection (offline: no connection) */
  | { ok: false; error: FormError | null; offline: boolean }
  | null;

/**
 * One profile form: submit → FormOk (then everything is refreshed) or a
 * FormError to show. `status` is what the website's form shows below it.
 */
export function useProfileForm<I>(
  submit: (input: I) => Promise<FormOk | Ok>,
  onSaved?: (result: FormOk | Ok) => void,
) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FormStatus>(null);
  const mutation = useMutation({
    mutationFn: submit,
    onMutate: () => setStatus(null),
    onSuccess: async (result) => {
      setStatus({
        ok: true,
        message: "message" in result ? result.message : "",
      });
      await refreshProfile(queryClient);
      onSaved?.(result);
    },
    onError: (e) =>
      setStatus({
        ok: false,
        error: formErrorOf(e),
        offline: isApiError(e) && e.status === 0,
      }),
  });
  const fieldError = (field: string): string | undefined =>
    status && !status.ok ? status.error?.fieldErrors?.[field] : undefined;
  return { mutation, status, setStatus, fieldError };
}
