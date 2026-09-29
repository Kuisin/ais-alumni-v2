/**
 * Social links stored in User.socialLinks (JSON, private tier §9.1).
 * Pure helpers shared by the profile edit action and the profile view.
 */

export const SOCIAL_KEYS = [
  "instagram",
  "linkedin",
  "facebook",
  "x",
  "website",
] as const;

export type SocialKey = (typeof SOCIAL_KEYS)[number];
export type SocialLinks = Partial<Record<SocialKey, string>>;

export const SOCIAL_URL_MAX = 300;

/** Only absolute http(s) URLs are accepted (no javascript:, data:, …). */
export function isHttpUrl(value: string): boolean {
  if (value.length > SOCIAL_URL_MAX) return false;
  try {
    const u = new URL(value);
    return (
      (u.protocol === "https:" || u.protocol === "http:") && Boolean(u.hostname)
    );
  } catch {
    return false;
  }
}

/** Read the stored JSON defensively; unknown keys and bad URLs are dropped. */
export function parseSocialLinks(json: unknown): SocialLinks {
  const out: SocialLinks = {};
  if (!json || typeof json !== "object" || Array.isArray(json)) return out;
  const rec = json as Record<string, unknown>;
  for (const key of SOCIAL_KEYS) {
    const v = rec[key];
    if (typeof v === "string" && isHttpUrl(v)) out[key] = v;
  }
  return out;
}
