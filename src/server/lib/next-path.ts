/**
 * "Return to the page you asked for" after signing in (?next=). Only app
 * pages on this site are accepted — never another origin — and the locale
 * prefix is dropped (the member's language applies).
 */
export const NEXT_PATH_HEADER = "x-ais-path";

/** "/ja/app/x?y" → "/app/x?y" (the path without its locale prefix). */
export function stripLocale(path: string): string {
  return path.replace(/^\/(ja|en)(?=\/|$|\?)/, "") || "/";
}

export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 500) return null;
  // Absolute paths on this site only (no //host, no backslashes).
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return null;
  let path = value.replace(/^\/(ja|en)(?=\/|$)/, "") || "/";
  if (!path.startsWith("/app/")) return null;
  // Sign-in and onboarding screens decide for themselves.
  if (/^\/app\/(onboarding|auth)(\/|$|\?)/.test(path)) return null;
  try {
    // Must stay a same-origin path after URL parsing.
    const u = new URL(path, "https://x.invalid");
    if (u.origin !== "https://x.invalid") return null;
    path = u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
  return path;
}
