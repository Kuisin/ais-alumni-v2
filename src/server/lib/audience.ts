import type { Prisma } from "@/server/generated/prisma/client";
import { AudienceKey, RoleKey } from "@/server/generated/prisma/enums";

/**
 * Audiences for events, news and notifications (pure; unit-tested).
 *
 * Like roles, except former students are split by UserRole.didGraduate into
 * 卒業生 (GRADUATE) and 元在校生 (LEFT_STUDENT: left before graduating).
 * Records keep the legacy `targetRoles` column filled for older code; when
 * `targetAudiences` is empty (e.g. written by that code) it is derived from
 * targetRoles. Both empty = everyone.
 */

export const AUDIENCE_KEYS: readonly AudienceKey[] = [
  AudienceKey.TEACHER,
  AudienceKey.CURRENT_STUDENT,
  AudienceKey.CURRENT_PARENT,
  AudienceKey.GRADUATE,
  AudienceKey.LEFT_STUDENT,
  AudienceKey.FORMER_PARENT,
];

const FORMER_HALVES: readonly AudienceKey[] = [
  AudienceKey.GRADUATE,
  AudienceKey.LEFT_STUDENT,
];

/** The legacy role an audience belongs to. */
export function roleOfAudience(a: AudienceKey): RoleKey {
  return a === AudienceKey.GRADUATE || a === AudienceKey.LEFT_STUDENT
    ? RoleKey.FORMER_STUDENT
    : (a as RoleKey);
}

/** Roles to store in the legacy column (both halves collapse to one role). */
export function rolesForAudiences(
  audiences: readonly AudienceKey[],
): RoleKey[] {
  return [...new Set(audiences.map(roleOfAudience))];
}

/** Audiences a legacy role list stands for. */
export function audiencesForRoles(roles: readonly RoleKey[]): AudienceKey[] {
  return [
    ...new Set(
      roles.flatMap((r) =>
        r === RoleKey.FORMER_STUDENT ? FORMER_HALVES : [r as AudienceKey],
      ),
    ),
  ];
}

export type Targeted = {
  targetAudiences: readonly AudienceKey[];
  targetRoles: readonly RoleKey[];
};

/** The audiences a record is aimed at ([] = everyone). */
export function effectiveAudiences(t: Targeted): AudienceKey[] {
  return t.targetAudiences.length
    ? [...t.targetAudiences]
    : audiencesForRoles(t.targetRoles);
}

/**
 * A member's audiences. A former student whose graduation is unknown
 * belongs to both halves.
 */
export function audiencesOfMember(
  roles: readonly { role: RoleKey; didGraduate?: boolean | null }[],
): AudienceKey[] {
  return [
    ...new Set(
      roles.flatMap((r) => {
        if (r.role !== RoleKey.FORMER_STUDENT) return [r.role as AudienceKey];
        if (r.didGraduate === true) return [AudienceKey.GRADUATE];
        if (r.didGraduate === false) return [AudienceKey.LEFT_STUDENT];
        return FORMER_HALVES;
      }),
    ),
  ];
}

/** Whether a viewer sees a targeted record (admins see everything). */
export function isAudienceTargeted(
  t: Targeted,
  viewer: { isAdmin: boolean; audiences?: readonly AudienceKey[] },
): boolean {
  const target = effectiveAudiences(t);
  if (viewer.isAdmin || target.length === 0) return true;
  return target.some((a) => (viewer.audiences ?? []).includes(a));
}

/** DB filter equivalent of isAudienceTargeted for events and news lists. */
export function audienceWhere(viewer: {
  isAdmin: boolean;
  audiences?: readonly AudienceKey[];
}) {
  if (viewer.isAdmin) return {};
  const aud = [...(viewer.audiences ?? [])];
  const roles = rolesForAudiences(aud);
  return {
    OR: [
      {
        targetAudiences: { isEmpty: true },
        targetRoles: { isEmpty: true },
      },
      { targetAudiences: { hasSome: aud } },
      // Written by older code: only targetRoles is set.
      {
        targetAudiences: { isEmpty: true },
        targetRoles: { hasSome: roles },
      },
    ],
  };
}

/** Members in any of the audiences ([] = no restriction). */
export function membersInAudiences(
  audiences: readonly AudienceKey[],
): Prisma.UserWhereInput {
  if (audiences.length === 0) return {};
  const plain = audiences
    .filter((a) => !FORMER_HALVES.includes(a))
    .map((a) => a as RoleKey);
  const grad = audiences.includes(AudienceKey.GRADUATE);
  const left = audiences.includes(AudienceKey.LEFT_STUDENT);
  const or: Prisma.UserRoleWhereInput[] = [];
  if (plain.length) or.push({ role: { in: plain } });
  if (grad && left) or.push({ role: RoleKey.FORMER_STUDENT });
  else if (grad)
    or.push({
      role: RoleKey.FORMER_STUDENT,
      OR: [{ didGraduate: true }, { didGraduate: null }],
    });
  else if (left)
    or.push({
      role: RoleKey.FORMER_STUDENT,
      OR: [{ didGraduate: false }, { didGraduate: null }],
    });
  return { roles: { some: { OR: or } } };
}

/** Parse submitted audience values (unknown values dropped). */
export function parseAudiences(values: readonly unknown[]): AudienceKey[] {
  return [
    ...new Set(
      values.filter((v): v is AudienceKey =>
        AUDIENCE_KEYS.includes(v as AudienceKey),
      ),
    ),
  ];
}

/**
 * Message key (in "roles") for a member's role: former students show as
 * 卒業生 or 元在校生 when known.
 */
export function roleLabelKey(r: {
  role: RoleKey;
  didGraduate?: boolean | null;
}): string {
  if (r.role === RoleKey.FORMER_STUDENT && r.didGraduate === true)
    return "audience.GRADUATE";
  if (r.role === RoleKey.FORMER_STUDENT && r.didGraduate === false)
    return "audience.LEFT_STUDENT";
  return `role.${r.role}`;
}

/** Filter values accepted by member lists: audiences, plus the old role. */
export type MemberFilterKey = AudienceKey | typeof RoleKey.FORMER_STUDENT;

export function parseMemberFilter(v: unknown): MemberFilterKey | null {
  if (v === RoleKey.FORMER_STUDENT) return RoleKey.FORMER_STUDENT;
  return AUDIENCE_KEYS.includes(v as AudienceKey) ? (v as AudienceKey) : null;
}

/** The UserRole row condition for a member-list filter (strict: unknown excluded). */
export function roleRowWhere(k: MemberFilterKey): Prisma.UserRoleWhereInput {
  if (k === AudienceKey.GRADUATE)
    return { role: RoleKey.FORMER_STUDENT, didGraduate: true };
  if (k === AudienceKey.LEFT_STUDENT)
    return { role: RoleKey.FORMER_STUDENT, didGraduate: false };
  return { role: k as RoleKey };
}

/**
 * Member-list filter options (directory, admin): former students are
 * 「卒業生」 or 「卒業生＋元在校生」 (FORMER_STUDENT = everyone who left AIS).
 */
export const MEMBER_FILTER_OPTIONS: readonly MemberFilterKey[] = [
  AudienceKey.TEACHER,
  AudienceKey.CURRENT_STUDENT,
  AudienceKey.CURRENT_PARENT,
  AudienceKey.GRADUATE,
  RoleKey.FORMER_STUDENT,
  AudienceKey.FORMER_PARENT,
];
