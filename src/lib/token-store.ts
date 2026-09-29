import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * The session token lives in the device keychain / keystore. (Web is only
 * used for local testing: localStorage there.)
 */
const KEY = "ais.session";

export async function loadToken(): Promise<string | null> {
  if (Platform.OS === "web")
    return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
