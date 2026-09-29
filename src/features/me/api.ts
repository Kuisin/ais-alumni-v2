import type {
  DeviceList,
  DeviceSignOutResult,
  MyProfile,
  MySettings,
  NotifyUpdate,
  OtherDevicesSignOutResult,
} from "@contract/account";
import type { Locale } from "@contract/core";
import {
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { api, setApiSession } from "@/lib/api";
import { ME_KEY, useAuth } from "@/lib/auth";

/** マイページ / 設定 data (GET /profile, /settings, /settings/devices). */
export const PROFILE_KEY = ["profile"] as const;
export const SETTINGS_KEY = ["settings"] as const;
export const DEVICES_KEY = ["settings", "devices"] as const;
const NOTIFY_MUTATION = ["settings", "notify"] as const;

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: ({ signal }) => api<MyProfile>("/profile", { signal }),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: ({ signal }) => api<MySettings>("/settings", { signal }),
  });
}

export function useDevices() {
  return useQuery({
    queryKey: DEVICES_KEY,
    queryFn: ({ signal }) => api<DeviceList>("/settings/devices", { signal }),
  });
}

/**
 * Refetch a screen's data when it comes back into view and is stale (tab
 * screens stay mounted, so changes made elsewhere would otherwise wait for
 * a pull-to-refresh). `queryKey` must be a constant.
 */
export function useRefetchOnFocus(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries(
        { queryKey, stale: true, type: "active" },
        { cancelRefetch: false },
      );
    }, [queryClient, queryKey]),
  );
}

/**
 * 設定 → 言語. The whole app follows the member's saved language: refetch
 * /me first (the UI switches), then everything else, since the server
 * writes some text in the member's language.
 */
export function useSaveLanguage() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: (locale: Locale) =>
      api<MySettings>("/settings/language", {
        method: "PUT",
        body: { locale },
      }),
    onSuccess: async (settings) => {
      queryClient.setQueryData(SETTINGS_KEY, settings);
      // Requests from here on ask for the new language.
      setApiSession(token, settings.locale);
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== ME_KEY[0],
      });
    },
  });
}

function withNotify(s: MySettings, patch: NotifyUpdate): MySettings {
  const on = patch.on ? new Set(patch.on) : null;
  return {
    ...s,
    notify: {
      ...s.notify,
      via: patch.via ?? s.notify.via,
      categories: on
        ? s.notify.categories.map((c) => ({
            ...c,
            on: c.locked || on.has(c.key),
          }))
        : s.notify.categories,
    },
  };
}

/**
 * 設定 → 通知, saved as soon as it's changed (optimistic). Changes run one
 * after another, and only the last answer is shown, so quick taps don't
 * flicker.
 */
export function useSaveNotify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: NOTIFY_MUTATION,
    scope: { id: "settings-notify" },
    mutationFn: (patch: NotifyUpdate) =>
      api<MySettings>("/settings/notifications", {
        method: "PATCH",
        body: patch,
      }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_KEY, exact: true });
      const previous = queryClient.getQueryData<MySettings>(SETTINGS_KEY);
      if (previous)
        queryClient.setQueryData(SETTINGS_KEY, withNotify(previous, patch));
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous)
        queryClient.setQueryData(SETTINGS_KEY, context.previous);
    },
    onSuccess: (settings) => {
      if (queryClient.isMutating({ mutationKey: NOTIFY_MUTATION }) <= 1)
        queryClient.setQueryData(SETTINGS_KEY, settings);
    },
  });
}

/** Sign out one of my other devices. */
export function useSignOutDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<DeviceSignOutResult>(`/settings/devices/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<DeviceList>(DEVICES_KEY, (list) =>
        list ? { devices: list.devices.filter((d) => d.id !== id) } : list,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
  });
}

/** Sign out every device except this one. */
export function useSignOutOtherDevices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<OtherDevicesSignOutResult>("/settings/devices", {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.setQueryData<DeviceList>(DEVICES_KEY, (list) =>
        list ? { devices: list.devices.filter((d) => d.current) } : list,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
  });
}
