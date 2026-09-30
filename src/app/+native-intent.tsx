import Constants from "expo-constants";
import { Linking } from "react-native";

/**
 * Incoming links. aisalumni://auth?code=… is the Google / LINE sign-in
 * returning (handled by WebBrowser.openAuthSessionAsync in src/lib/auth.tsx),
 * not a screen; on Android the router sees it too, so send it home.
 * aisalumni://line-link?line=… ends linking LINE (src/features/line) the
 * same way: stay on the screen that started it.
 * aisalumni://authorize?code=…&state=… is the LINE app finishing a LINE SDK
 * sign-in (src/lib/line-sdk.ts) on the app's scheme instead of the SDK's
 * own (line3rdp.<bundle id>): hand it to the SDK under that scheme — iOS
 * opens it right back here, where the SDK takes it — and stay put.
 */
const LINE_RETURN = `line3rdp.${
  Constants.expoConfig?.ios?.bundleIdentifier ?? "net.kailab.aisalumni"
}`;
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    const p = path
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "/")
      .replace(/^\/+/, "/");
    if (/^\/(--\/)?auth(\?|$)/.test(p)) return "/";
    if (/^\/(--\/)?line-link(\?|$)/.test(p)) return initial ? "/" : null;
    if (/^\/authorize\/?\?/.test(p)) {
      const query = p.slice(p.indexOf("?"));
      void Linking.openURL(`${LINE_RETURN}://authorize/${query}`).catch(
        () => {},
      );
      return initial ? "/" : null;
    }
    return path;
  } catch {
    return "/";
  }
}
