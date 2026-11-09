import type { Me, MySanction } from "@contract/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { ApiError, api } from "@/lib/api";
import { ME_KEY, useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

/**
 * 処分 (src/server/lib/sanctions.ts): what /me says applies to the member,
 * the warning's acknowledgement, the errors the API answers while one
 * applies (the admin's side: admin-api.ts).
 */

/** SUSPENDED / BANNED: only the sanction screen (app/sanction.tsx). */
export function isBlocking(s: MySanction | null | undefined): boolean {
  return s?.level === "SUSPENDED" || s?.level === "BANNED";
}

export function blockingSanction(me: Me | null): MySanction | null {
  const s = me?.sanction ?? null;
  return isBlocking(s) ? s : null;
}

/** 警告 → 「確認しました」. */
export function useAckWarning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>("/me/sanction/ack", { body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_KEY }),
  });
}

/** "2026年12月1日(火)まで" / "解除されるまで". */
export function useSanctionPeriod(): (endsAt: string | null) => string {
  const t = useTranslations("mobile.sanction");
  const { locale } = useAuth();
  return (endsAt) =>
    endsAt
      ? t("until", { date: formatDate(endsAt, locale) })
      : t("untilLifted");
}

const SANCTION_ERRORS = new Set(["restricted", "suspended", "banned"]);

/**
 * The text for a request refused because of the member's sanction (403
 * "restricted" / "suspended" / "banned"); null for any other error. Takes
 * the error, or its code.
 */
export function useSanctionError(): (error: unknown) => string | null {
  const t = useTranslations("mobile.sanction.errors");
  return (error) => {
    const code =
      error instanceof ApiError
        ? error.code
        : typeof error === "string"
          ? error
          : null;
    return code && SANCTION_ERRORS.has(code)
      ? t(code as "restricted" | "suspended" | "banned")
      : null;
  };
}
