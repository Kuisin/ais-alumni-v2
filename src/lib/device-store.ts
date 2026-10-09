import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Small per-device settings (a choice made on this device, a "later"
 * date): the keychain in the apps, localStorage in the web app — where
 * expo-secure-store has nothing to store in. Never throws.
 */

export async function getDeviceItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web")
      return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setDeviceItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Private browsing / a locked keychain: it isn't remembered.
  }
}

export async function removeDeviceItem(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // As above.
  }
}
