import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";

/** Entry: send the member where their account belongs. */
export default function Index() {
  const { status, me } = useAuth();
  if (status === "loading") return null; // the splash screen is still up
  if (status === "signedOut") return <Redirect href="/sign-in" />;
  if (status === "unreachable") return <Redirect href="/offline" />;
  if (me?.user.state !== "ACTIVE") return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
