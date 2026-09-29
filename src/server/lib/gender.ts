/** 性別 (default profile icon); safe for client components. */
export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export type Gender = (typeof GENDERS)[number];

export function isGender(v: unknown): v is Gender {
  return typeof v === "string" && (GENDERS as readonly string[]).includes(v);
}

/** Default icons (public/avatars). */
export function defaultAvatar(gender: string | null | undefined): string {
  if (gender === "MALE") return "/avatars/default-male.jpg";
  if (gender === "FEMALE") return "/avatars/default-female.jpg";
  return "/avatars/default.svg";
}
