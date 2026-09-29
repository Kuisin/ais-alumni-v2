/**
 * Teachers' school (work) email: an @aisnagoya.net address confirmed with
 * a code — an extra check that they work at AIS. Kept on the TEACHER role
 * (UserRole.schoolEmail / schoolEmailVerified), separate from the main
 * email used for sign-in and notifications. Safe for client components.
 */
export const SCHOOL_EMAIL_DOMAIN = "aisnagoya.net";

export function isSchoolEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  return at > 0 && e.slice(at + 1) === SCHOOL_EMAIL_DOMAIN;
}
