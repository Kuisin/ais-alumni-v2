import type { OnboardingStep } from "@contract/onboarding";
import type { Href } from "expo-router";

/**
 * Onboarding data: GET /onboarding/{line,status,verify} are read with
 * react-query under ["onboarding", …]; the account's step itself comes from
 * /me (`onboardingPath`), which every action refreshes.
 */
export const ONBOARDING_KEY = ["onboarding"] as const;

const STEPS: Record<string, OnboardingStep> = {
  "/app/onboarding/email": "email",
  "/app/onboarding/line": "line",
  "/app/onboarding/verify": "verify",
  "/app/onboarding/status": "status",
};

/** The onboarding screen for /me's onboardingPath (the website's homePathFor). */
export function stepFor(path: string | null | undefined): OnboardingStep {
  return (path && STEPS[path]) || "status";
}

export function stepHref(step: OnboardingStep): Href {
  return `/onboarding/${step}` as Href;
}
