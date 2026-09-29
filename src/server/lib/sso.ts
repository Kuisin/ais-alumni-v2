/**
 * Which social sign-ins are configured. A provider without its client id and
 * secret is shown as "not ready yet" instead of failing at the provider.
 */
export type SsoProvider = "google" | "line";

export function ssoReady(provider: SsoProvider): boolean {
  const env =
    provider === "google"
      ? [process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET]
      : [process.env.AUTH_LINE_ID, process.env.AUTH_LINE_SECRET];
  return env.every((v) => Boolean(v?.trim()));
}
