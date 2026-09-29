import { Redirect, Stack } from "expo-router";
import { Platform } from "react-native";
import { useTranslations } from "use-intl";
import { Landing } from "@/features/public/landing";
import { useAuth } from "@/lib/auth";

/**
 * Entry: send the member where their account belongs. On the web, visitors
 * who aren't signed in see the landing page here (the website's /), with
 * sign-in one tap away; the apps go straight to sign-in.
 */
export default function Index() {
  const { status, me } = useAuth();
  const t = useTranslations("home");
  if (status === "loading") return null; // the splash screen is still up
  if (status === "signedOut")
    return Platform.OS === "web" ? (
      <>
        <Stack.Screen options={{ title: t("metaTitle") }} />
        <Landing />
      </>
    ) : (
      <Redirect href="/sign-in" />
    );
  if (status === "unreachable") return <Redirect href="/offline" />;
  if (me?.user.state !== "ACTIVE") return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
