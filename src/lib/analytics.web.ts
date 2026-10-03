import { type BeforeSendEvent, inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";

/** Paths whose last part is a secret (sign-in codes, invitations). */
const SECRET_PATH = /^\/(handover|invite)\/[^/?#]+/;

/** The URL without secrets: tokens in /handover and /invite links, and
 * every query string (sign-in codes, ?from=…). */
function redact<T extends { url: string }>(event: T): T {
  const url = new URL(event.url);
  url.pathname = url.pathname.replace(SECRET_PATH, "/$1/[token]");
  url.search = "";
  return { ...event, url: url.toString() };
}

/**
 * Vercel Web Analytics (page views) and Speed Insights (page load
 * metrics) for the web app — both switched on for the project in Vercel.
 */
export function startAnalytics(): void {
  inject({
    mode: __DEV__ ? "development" : "production",
    beforeSend: (event: BeforeSendEvent) => redact(event),
  });
  if (!__DEV__) injectSpeedInsights({ beforeSend: (event) => redact(event) });
}
