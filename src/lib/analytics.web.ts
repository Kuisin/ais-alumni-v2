import { type BeforeSendEvent, inject } from "@vercel/analytics";

/** Paths whose last part is a secret (sign-in codes, invitations). */
const SECRET_PATH = /^\/(handover|invite)\/[^/?#]+/;

/**
 * Vercel Web Analytics for the web app (page views; the project has it on
 * in Vercel). Secrets in URLs are cut out: tokens in /handover and /invite
 * links, and every query string (sign-in codes, ?from=…).
 */
export function startAnalytics(): void {
  inject({
    mode: __DEV__ ? "development" : "production",
    beforeSend: (event: BeforeSendEvent) => {
      const url = new URL(event.url);
      url.pathname = url.pathname.replace(SECRET_PATH, "/$1/[token]");
      url.search = "";
      return { ...event, url: url.toString() };
    },
  });
}
