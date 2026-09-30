// Must load before anything formats messages.
import "@/lib/intl-polyfills";
// Before the first render: sees the notification tap that launched the app.
import "@/lib/push-core";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  UpdateRequired,
  useUpdateRequired,
} from "@/features/update/update-required";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { stackScreenOptions } from "@/lib/navigation";
import { PushProvider } from "@/lib/push";
import { queryClient } from "@/lib/query";
import { RealtimeProvider } from "@/lib/realtime";

SplashScreen.preventAutoHideAsync().catch(() => {});

// A screen that fails to render shows what went wrong, not a closed app.
export { CrashScreen as ErrorBoundary } from "@/features/errors/crash-screen";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Which part of the app is reachable follows the account (src/lib/auth.tsx):
 * signed out → sign-in; not yet approved → onboarding; ACTIVE members →
 * everything under (member).
 */
function Root() {
  const { status, me, locale } = useAuth();
  const signedIn = status === "signedIn";
  const active = signedIn && me?.user.state === "ACTIVE";
  const update = useUpdateRequired();

  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  // Keep the splash screen until the session is known: the navigator (and
  // its guards) then first renders with the real state, so a link that
  // opened the app (e.g. /events/…) lands there instead of the anchor.
  if (status === "loading") return null;

  // This version no longer works with the server (its minAppVersion).
  if (update)
    return (
      <I18nProvider locale={locale}>
        <StatusBar style="dark" />
        <UpdateRequired {...update} />
      </I18nProvider>
    );

  return (
    <I18nProvider locale={locale}>
      <PushProvider>
        <RealtimeProvider config={active ? (me?.realtime ?? null) : null}>
          <StatusBar style="dark" />
          <Stack screenOptions={stackScreenOptions}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen
              name="invite/[token]"
              options={{ headerShown: false }}
            />
            <Stack.Protected guard={status === "signedOut"}>
              <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={status === "unreachable"}>
              <Stack.Screen name="offline" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && !active}>
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false }}
              />
            </Stack.Protected>
            <Stack.Protected guard={active}>
              <Stack.Screen name="(member)" options={{ headerShown: false }} />
            </Stack.Protected>
          </Stack>
        </RealtimeProvider>
      </PushProvider>
    </I18nProvider>
  );
}
