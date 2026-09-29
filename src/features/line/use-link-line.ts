import type {
  LineLinkOutcome,
  LineLinkRequest,
  LineLinkStart,
} from "@contract/line";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import { ME_KEY } from "@/lib/auth";

/**
 * 「LINE を連携する」 for any screen (設定, Home, onboarding): the server
 * gives a fresh start URL (src/server/lib/mobile/line-link.ts), the member
 * signs in to LINE in the browser and comes back with the outcome.
 *
 * - Native: an auth session that closes at aisalumni://line-link; the
 *   mutation resolves to the outcome, and /me, settings and Home reload.
 * - Web: the page goes to LINE and comes back to `returnTo` (a path of
 *   the web app, e.g. "/settings") with ?line=<outcome> — read it there
 *   with useLineLinkReturn(). The mutation resolves to null.
 */
export function useLinkLine(returnTo: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<LineLinkOutcome | null> => {
      const web = Platform.OS === "web";
      const body: LineLinkRequest = web
        ? { returnTo }
        : { returnTo, redirect: Linking.createURL("line-link") };
      const start = await api<LineLinkStart>("/line/link", { body });
      if (web) {
        globalThis.location?.assign(start.url);
        return null;
      }
      const res = await WebBrowser.openAuthSessionAsync(
        start.url,
        start.redirect,
        { preferEphemeralSession: true },
      );
      if (res.type !== "success") return "cancelled";
      return parseOutcome(Linking.parse(res.url).queryParams?.line);
    },
    onSuccess: async (outcome) => {
      if (!outcome || outcome === "cancelled") return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ME_KEY }),
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
  });
}

const OUTCOMES: readonly LineLinkOutcome[] = [
  "linked",
  "taken",
  "cancelled",
  "error",
  "expired",
];

export function parseOutcome(value: unknown): LineLinkOutcome {
  const v = Array.isArray(value) ? value[0] : value;
  return OUTCOMES.includes(v as LineLinkOutcome)
    ? (v as LineLinkOutcome)
    : "error";
}

/**
 * Web: the outcome the page came back with (?line=…), taken off the URL so
 * a reload doesn't show it again. Always null on native.
 */
export function useLineLinkReturn(): LineLinkOutcome | null {
  const { line } = useLocalSearchParams<{ line?: string }>();
  const router = useRouter();
  const [outcome, setOutcome] = useState<LineLinkOutcome | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || !line) return;
    setOutcome(parseOutcome(line));
    router.setParams({ line: undefined });
  }, [line, router]);
  return outcome;
}
