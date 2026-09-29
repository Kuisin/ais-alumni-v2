import { Alert, Platform } from "react-native";

type Options = {
  title: string;
  message?: string;
  confirm: string;
  cancel: string;
  destructive?: boolean;
};

/**
 * Ask before signing out and similar: the system alert on phones
 * (window.confirm in the web build, which is only for local testing —
 * React Native Web's Alert does nothing).
 */
export function confirmAction(o: Options): Promise<boolean> {
  if (Platform.OS === "web")
    return Promise.resolve(
      window.confirm([o.title, o.message].filter(Boolean).join("\n\n")),
    );
  return new Promise((resolve) => {
    Alert.alert(
      o.title,
      o.message,
      [
        { text: o.cancel, style: "cancel", onPress: () => resolve(false) },
        {
          text: o.confirm,
          style: o.destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
