import { isRunningInExpoGo } from "expo";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

/**
 * Sign in with Apple (iOS only; App Store guideline 4.8 asks for it next to
 * LINE): iOS's own sheet, then the server checks the identity token
 * (POST /auth/apple/native) and answers with a session. The nonce ties the
 * token to this sign-in.
 */

/**
 * Offered on iOS (13+, which the app requires) — not by asking
 * isAvailableAsync(), which said no in Expo Go and must not hide the
 * button App Review looks for. Not in Expo Go: its Apple tokens are issued
 * to Expo Go, which production doesn't accept.
 */
export function appleSignInOffered(): boolean {
  return Platform.OS === "ios" && !isRunningInExpoGo();
}

export type AppleSignIn =
  | {
      type: "ok";
      identityToken: string;
      nonce: string;
      authorizationCode: string | null;
      /** first sign-in only: what the member gave Apple */
      fullName: {
        givenName: string | null;
        middleName: string | null;
        familyName: string | null;
      } | null;
    }
  | { type: "cancelled" }
  | { type: "failed" };

export async function appleSignIn(): Promise<AppleSignIn> {
  const nonce = Crypto.randomUUID() + Crypto.randomUUID();
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
    if (!credential.identityToken) return { type: "failed" };
    return {
      type: "ok",
      identityToken: credential.identityToken,
      nonce,
      authorizationCode: credential.authorizationCode,
      fullName: credential.fullName
        ? {
            givenName: credential.fullName.givenName,
            middleName: credential.fullName.middleName,
            familyName: credential.fullName.familyName,
          }
        : null,
    };
  } catch (e) {
    return (e as { code?: string }).code === "ERR_REQUEST_CANCELED"
      ? { type: "cancelled" }
      : { type: "failed" };
  }
}
