import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/lib/auth";
import { Loading } from "@/ui";

/**
 * Where LINE sign-in returns on the web (…/auth?code=… or ?error=…): trade
 * the code for a session with the verifier this tab kept (src/lib/auth.tsx),
 * then go home — or back to sign-in with the error shown. Native apps
 * receive aisalumni://auth in their sign-in browser instead.
 */
export default function AuthReturn() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { completeWebSignIn } = useAuth();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || started.current) return;
    started.current = true;
    if (!code) {
      router.replace("/sign-in?failed=1");
      return;
    }
    void completeWebSignIn(code).then((r) =>
      router.replace(r === "ok" ? "/" : "/sign-in?failed=1"),
    );
  }, [code, completeWebSignIn, router]);

  if (Platform.OS !== "web") return <Redirect href="/" />;
  return <Loading />;
}
