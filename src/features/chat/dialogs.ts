import { Alert, Platform } from "react-native";

/**
 * System dialogs (Alert on iOS / Android; the browser's on the web build,
 * where Alert does nothing).
 */

type WebDialogs = {
  confirm?: (message: string) => boolean;
  alert?: (message: string) => void;
};
const web = globalThis as WebDialogs;

/** Ask before something destructive; resolves true to go ahead. */
export function confirmDestructive(
  message: string,
  labels: { confirm: string; cancel: string },
): Promise<boolean> {
  if (Platform.OS === "web")
    return Promise.resolve(web.confirm?.(message) ?? true);
  return new Promise((resolve) =>
    Alert.alert(
      message,
      undefined,
      [
        { text: labels.cancel, style: "cancel", onPress: () => resolve(false) },
        {
          text: labels.confirm,
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

/** Tell the member something went wrong. */
export function showError(message: string): void {
  if (Platform.OS === "web") web.alert?.(message);
  else Alert.alert(message);
}

/** A short message with a title (e.g. who reacted). */
export function showInfo(title: string, message: string): void {
  if (Platform.OS === "web") web.alert?.(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
