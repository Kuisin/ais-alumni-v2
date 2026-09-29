/**
 * Incoming links. aisalumni://auth?code=… is the Google / LINE sign-in
 * returning (handled by WebBrowser.openAuthSessionAsync in src/lib/auth.tsx),
 * not a screen; on Android the router sees it too, so send it home.
 * aisalumni://line-link?line=… ends linking LINE (src/features/line) the
 * same way: stay on the screen that started it.
 */
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
    return path;
  } catch {
    return "/";
  }
}
