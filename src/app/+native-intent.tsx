import Constants from "expo-constants";
import { Linking } from "react-native";
import { API_URL } from "@/lib/config";
import { webPathFor } from "@/lib/site-paths";

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
 *
 * https links to the site (universal links, app.config.ts
 * associatedDomains): this web app's paths are the app's, so they open
 * as they are; the old website's (/ja/app/news/…) map to the matching
 * screen; notification short links (/n/…) are resolved by the server,
 * which records the open and answers with the screen's path.
 */
const SITE_HOST = /^(ais-alumni(-dev)?|ais)\.kai-lab\.net$/i;
const OLD_SITE_PATH = /^\/(ja|en|app)(\/|$)/;

async function shortLinkPath(url: URL): Promise<string> {
  try {
    const res = await fetch(`${API_URL}${url.pathname}`);
    const path = new URL(res.url).pathname;
    return path.startsWith("/n/") ? "/" : path || "/";
  } catch {
    return "/";
  }
}

function sitePath(url: URL): string | Promise<string> {
  if (url.pathname.startsWith("/n/")) return shortLinkPath(url);
  const path = url.pathname + url.search;
  return OLD_SITE_PATH.test(url.pathname) ? webPathFor(path) : path;
}

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
    if (/^https?:\/\//i.test(path)) {
      const url = new URL(path);
      if (SITE_HOST.test(url.hostname)) return sitePath(url);
    }
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
