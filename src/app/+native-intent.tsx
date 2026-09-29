/**
 * Incoming links. aisalumni://auth?code=… is the Google / LINE sign-in
 * returning (handled by WebBrowser.openAuthSessionAsync in src/lib/auth.tsx),
 * not a screen; on Android the router sees it too, so send it home.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    const p = path
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "/")
      .replace(/^\/+/, "/");
    if (/^\/(--\/)?auth(\?|$)/.test(p)) return "/";
    return path;
  } catch {
    return "/";
  }
}
