import { Stack } from "expo-router";
import { stepFor } from "@/features/onboarding/api";
import { useAuth } from "@/lib/auth";

/**
 * Registration, one screen per account state (the website's
 * /app/onboarding/*): each step is reachable only while /me says the
 * account is on it — as the website's requireState() redirects — so a
 * finished step (or an approval) moves the member on by itself.
 */
export default function OnboardingLayout() {
  const { me } = useAuth();
  const step = stepFor(me?.onboardingPath);
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={step === "email"}>
        <Stack.Screen name="email" />
      </Stack.Protected>
      <Stack.Protected guard={step === "line"}>
        <Stack.Screen name="line" />
      </Stack.Protected>
      <Stack.Protected guard={step === "verify"}>
        <Stack.Screen name="verify" />
      </Stack.Protected>
      <Stack.Protected guard={step === "status"}>
        <Stack.Screen name="status" />
      </Stack.Protected>
    </Stack>
  );
}
