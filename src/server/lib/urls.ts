/** Absolute base URL for links in emails and LINE messages. */
export function appUrl(path = ""): string {
  const base =
    process.env.APP_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://ais.kai-lab.net"
      : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${path}`;
}

/** The production site, used for every link sent by email or LINE. */
export const PUBLIC_SITE_URL = "https://ais.kai-lab.net";

/**
 * Absolute link for notifications (email, LINE). Always the production
 * domain, even when sent from the dev deployment, so members only ever see
 * and open ais.kai-lab.net. Technical URLs (OAuth callbacks) use appUrl().
 */
export function publicUrl(path = ""): string {
  return `${PUBLIC_SITE_URL}${path}`;
}
