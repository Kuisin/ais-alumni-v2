/** Absolute base URL for links in emails and LINE messages. */
export function appUrl(path = ""): string {
  const base =
    process.env.APP_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://ais-alumni.kai-lab.net"
      : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${path}`;
}

/**
 * The production site, used for every link sent by email or LINE: the
 * PUBLIC_SITE_URL environment variable (Vercel, not secret), else
 * ais-alumni.kai-lab.net.
 */
export const PUBLIC_SITE_URL = (
  process.env.PUBLIC_SITE_URL?.trim() || "https://ais-alumni.kai-lab.net"
).replace(/\/+$/, "");

/**
 * Absolute link for notifications (email, LINE). Always the production
 * domain, even when sent from the dev deployment, so members only ever see
 * and open ais-alumni.kai-lab.net. Technical URLs (OAuth callbacks) use appUrl().
 */
export function publicUrl(path = ""): string {
  return `${PUBLIC_SITE_URL}${path}`;
}
