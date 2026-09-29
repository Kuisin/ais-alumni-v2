import { RoleKey } from "@/server/generated/prisma/enums";

// The website's src/components/profile/role-details.tsx — only the part the
// API uses. Stable display order for a member with several roles.
const ORDER: RoleKey[] = [
  RoleKey.FORMER_STUDENT,
  RoleKey.CURRENT_STUDENT,
  RoleKey.TEACHER,
  RoleKey.CURRENT_PARENT,
  RoleKey.FORMER_PARENT,
];

export function sortRoles<T extends { role: RoleKey }>(
  roles: readonly T[],
): T[] {
  return [...roles].sort(
    (a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role),
  );
}
