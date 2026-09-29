/**
 * Linking LINE to the signed-in member (設定 → LINE, the Home banner,
 * onboarding). Pure types only (see core.ts): change additively.
 */

/**
 * The result, passed back to the app as `?line=<outcome>` (as the
 * website's line.outcome.<outcome> messages).
 */
export type LineLinkOutcome =
  | "linked"
  | "taken"
  | "cancelled"
  | "error"
  | "expired";

/**
 * POST /line/link (any signed-in account, also during onboarding) →
 * LineLinkStart; errors: line_unavailable (404).
 * `returnTo`: the web app's path to come back to ("/settings");
 * `redirect`: native apps' return URL ("aisalumni://line-link").
 */
export type LineLinkRequest = { returnTo: string; redirect?: string };

/** Open `url` in a browser (valid 10 minutes); it ends at `redirect`. */
export type LineLinkStart = { url: string; redirect: string };
