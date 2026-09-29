import type { InvitePreview } from "@contract/family";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { ApiError, api } from "./api";

/**
 * A member's invitation link (/invite/<token>, or aisalumni://invite/<token>)
 * opened on this device: the token is kept here — as the website keeps it
 * in a cookie for 30 days — until the application is sent with it. Sign-in
 * shows who invited (usePendingInvite), and the application form prefills
 * from it and passes the token on (consumed server-side by consumeInvite).
 */

const KEY = "ais.invite";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** react-query key of the pending invitation */
export const INVITE_KEY = ["invite", "pending"] as const;

type Saved = { token: string; savedAt: number };

async function read(): Promise<string | null> {
  if (Platform.OS === "web")
    return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY).catch(() => null);
}

async function write(value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (value === null) globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(KEY).catch(() => {});
  else await SecureStore.setItemAsync(KEY, value).catch(() => {});
}

/** The invitation token opened on this device (null: none, or too old). */
export async function pendingInviteToken(): Promise<string | null> {
  const raw = await read();
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Saved;
    if (typeof saved.token === "string" && Date.now() - saved.savedAt < TTL_MS)
      return saved.token;
  } catch {}
  await write(null);
  return null;
}

export async function savePendingInvite(token: string): Promise<void> {
  await write(JSON.stringify({ token, savedAt: Date.now() } satisfies Saved));
}

/** After the application went in with it (or it turned out unusable). */
export async function clearPendingInvite(): Promise<void> {
  await write(null);
}

/** Who invited, for an invitation token (null when unusable). */
export async function fetchInvite(
  token: string,
): Promise<InvitePreview | null> {
  try {
    return await api<InvitePreview>(`/invite/${encodeURIComponent(token)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export type PendingInvite = {
  token: string | null;
  invite: InvitePreview | null;
  /** a link was opened but can't be used (invalid, used or expired) */
  invalid: boolean;
};

/**
 * The invitation opened on this device, checked with the server. An
 * unusable one is forgotten (and reported once as `invalid`).
 */
export function usePendingInvite() {
  return useQuery({
    queryKey: INVITE_KEY,
    queryFn: async (): Promise<PendingInvite> => {
      const token = await pendingInviteToken();
      if (!token) return { token: null, invite: null, invalid: false };
      const invite = await fetchInvite(token);
      if (!invite) {
        await clearPendingInvite();
        return { token: null, invite: null, invalid: true };
      }
      return { token, invite, invalid: false };
    },
    staleTime: 5 * 60_000,
  });
}

/** Forget the invitation (after applying with it). */
export function useClearPendingInvite() {
  const queryClient = useQueryClient();
  return async () => {
    await clearPendingInvite();
    await queryClient.invalidateQueries({ queryKey: INVITE_KEY });
  };
}
