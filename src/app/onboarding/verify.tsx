import type { VerifyForm as VerifyFormData } from "@contract/onboarding";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type { ScrollView } from "react-native";
import { useTranslations } from "use-intl";
import { ONBOARDING_KEY } from "@/features/onboarding/api";
import { Notice } from "@/features/onboarding/controls";
import { OnboardingShell } from "@/features/onboarding/shell";
import { VerifyForm } from "@/features/onboarding/verify/verify-form";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  clearPendingInvite,
  INVITE_KEY,
  pendingInviteToken,
} from "@/lib/invite";
import { QueryState } from "@/ui";

/**
 * The application (the website's /app/onboarding/verify): first
 * submission, or a resubmission when the committee asked for more
 * (NEEDS_INFO). An invitation opened on this device prefills the type and
 * 学年 and is used up by the application.
 */
export default function OnboardingVerifyScreen() {
  const t = useTranslations("verify");
  const { locale, refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const q = useQuery({
    queryKey: [...ONBOARDING_KEY, "verify", locale],
    queryFn: async () => {
      const invite = await pendingInviteToken();
      const qs = new URLSearchParams({ locale });
      if (invite) qs.set("invite", invite);
      const form = await api<VerifyFormData>(`/onboarding/verify?${qs}`);
      return { form, invite };
    },
    // The form keeps its own state: don't reload it under the member.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  return (
    <OnboardingShell
      title={t("title")}
      description={
        q.data?.form.needsInfo ? t("resubmitDescription") : t("description")
      }
      scrollRef={scrollRef}
    >
      <QueryState query={q}>
        {({ form, invite }) => (
          <>
            {form.needsInfo ? (
              <Notice tone="warning" title={t("needsInfo.title")}>
                {form.reviewNote ?? undefined}
              </Notice>
            ) : null}
            <VerifyForm
              data={form}
              scrollRef={scrollRef}
              inviteToken={invite}
              onSubmitted={async () => {
                if (invite) {
                  await clearPendingInvite();
                  void queryClient.invalidateQueries({ queryKey: INVITE_KEY });
                }
                queryClient.removeQueries({ queryKey: ONBOARDING_KEY });
                // /me moves the account to the status screen.
                await refreshMe();
              }}
            />
          </>
        )}
      </QueryState>
    </OnboardingShell>
  );
}
