/**
 * Personal information on a profile (private tier §9.1). Visible to the
 * member, their family and admins; each field can also be shown to
 * accepted followers (User.followerFields — all off by default).
 */
export const PERSONAL_FIELDS = [
  "email",
  "phone",
  "lineDisplayName",
  "instagram",
  "linkedin",
  "facebook",
  "x",
  "website",
  "currentStageDetail",
] as const;

export type PersonalField = (typeof PERSONAL_FIELDS)[number];

export function isPersonalField(v: string): v is PersonalField {
  return (PERSONAL_FIELDS as readonly string[]).includes(v);
}

/** The fields shared with followers, cleaned (unknown values dropped). */
export function followerFieldSet(
  stored: readonly string[] | null | undefined,
): Set<PersonalField> {
  return new Set((stored ?? []).filter(isPersonalField));
}
