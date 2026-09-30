/**
 * The App Review demo account (App Store Review Guidelines: reviewers need
 * credentials that work without our email): for REVIEW_EMAIL the sign-in
 * code is always REVIEW_CODE and no email is sent. Everything else is a
 * normal sign-in — the same rate and attempt limits, the same account (one
 * the committee approved like any other; docs/APP_STORE.md). Unset either
 * variable to turn it off.
 */
export function reviewSignInCode(email: string): string | null {
  const reviewEmail = process.env.REVIEW_EMAIL?.trim();
  const code = process.env.REVIEW_CODE?.trim();
  if (!reviewEmail || !code || !/^\d{6}$/.test(code)) return null;
  // As otp.ts normalizes addresses (kept apart from it: no import cycle).
  return email.trim().toLowerCase() === reviewEmail.toLowerCase() ? code : null;
}
