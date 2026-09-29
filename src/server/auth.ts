/**
 * Auth.js lives in the website (Kuisin/ais-alumni-app): browser sign-in
 * (Google / LINE) and website sessions stay there. The API here only knows
 * the app's bearer tokens (src/server/lib/session.ts), so these are stubs
 * for the few shared modules that import them.
 */
export async function auth(): Promise<null> {
  return null;
}
export async function signIn(..._args: unknown[]): Promise<never> {
  throw new Error("signIn is only available on the website");
}
export async function signOut(..._args: unknown[]): Promise<never> {
  throw new Error("signOut is only available on the website");
}
