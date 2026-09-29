import { Redirect } from "expo-router";
import { stepFor, stepHref } from "@/features/onboarding/api";
import { useAuth } from "@/lib/auth";

/** /onboarding: the screen for where the account stands. */
export default function OnboardingIndex() {
  const { me } = useAuth();
  if (!me) return null;
  return <Redirect href={stepHref(stepFor(me.onboardingPath))} />;
}
