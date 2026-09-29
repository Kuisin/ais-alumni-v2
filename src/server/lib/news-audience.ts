import { z } from "zod";
import type { Prisma } from "@/server/generated/prisma/client";
import {
  AudienceKey,
  RoleKey,
  TeacherStatus,
} from "@/server/generated/prisma/enums";
import { audiencesForRoles, rolesForAudiences } from "@/server/lib/audience";

/**
 * Who receives a ニュース post (pure; unit-tested). A member receives it if
 * they match ANY selected condition; nothing selected = every member.
 *  - groups: 現職/元教職員, 在校生, 在校生保護者, 卒業生, 元在校生, 卒業生保護者
 *  - cohortIds: students / former students of these 学年 (and, with
 *    includeParents, the parents of children in them)
 *  - userIds: individually chosen members
 */

/**
 * Groups offered in the picker. Former students: 「卒業生」 (GRADUATE) or
 * 「卒業生＋元在校生」 (FORMER_STUDENT = everyone who attended AIS and left).
 */
export const AUDIENCE_GROUPS = [
  "TEACHER_CURRENT",
  "TEACHER_FORMER",
  "CURRENT_STUDENT",
  "CURRENT_PARENT",
  "GRADUATE",
  "FORMER_STUDENT",
  "FORMER_PARENT",
] as const;
/** Stored values: the offered groups plus LEFT_STUDENT from older posts. */
export const STORED_GROUPS = [...AUDIENCE_GROUPS, "LEFT_STUDENT"] as const;
export type AudienceGroup = (typeof STORED_GROUPS)[number];

export const MAX_AUDIENCE_USERS = 200;

export const audienceSpecSchema = z.object({
  groups: z.array(z.enum(STORED_GROUPS)).max(STORED_GROUPS.length).default([]),
  cohortIds: z.array(z.string().min(1).max(64)).max(100).default([]),
  includeParents: z.boolean().default(false),
  userIds: z
    .array(z.string().min(1).max(64))
    .max(MAX_AUDIENCE_USERS)
    .default([]),
});
export type AudienceSpec = z.infer<typeof audienceSpecSchema>;

export const EVERYONE: AudienceSpec = {
  groups: [],
  cohortIds: [],
  includeParents: false,
  userIds: [],
};

export function isEveryone(s: AudienceSpec): boolean {
  return !s.groups.length && !s.cohortIds.length && !s.userIds.length;
}

const STUDENT_ROLES: RoleKey[] = [
  RoleKey.CURRENT_STUDENT,
  RoleKey.FORMER_STUDENT,
];
const PARENT_ROLES: RoleKey[] = [RoleKey.CURRENT_PARENT, RoleKey.FORMER_PARENT];

/** The post's audience: the stored spec, or one derived from older columns. */
export function specFromPost(post: {
  audience: unknown;
  targetAudiences: readonly AudienceKey[];
  targetRoles: readonly RoleKey[];
}): AudienceSpec {
  const parsed = audienceSpecSchema.safeParse(post.audience);
  if (post.audience && parsed.success) return parsed.data;
  const keys = post.targetAudiences.length
    ? post.targetAudiences
    : audiencesForRoles(post.targetRoles);
  let groups = keys.flatMap((k): AudienceGroup[] =>
    k === AudienceKey.TEACHER
      ? ["TEACHER_CURRENT", "TEACHER_FORMER"]
      : [k as AudienceGroup],
  );
  // Both halves of former students = 「卒業生＋元在校生」.
  if (groups.includes("GRADUATE") && groups.includes("LEFT_STUDENT"))
    groups = [
      ...groups.filter((g) => g !== "GRADUATE" && g !== "LEFT_STUDENT"),
      "FORMER_STUDENT",
    ];
  return { ...EVERYONE, groups: [...new Set(groups)] };
}

/**
 * Older columns kept filled for code that doesn't know the spec: the roles a
 * post is (roughly) aimed at. 学年 targets map to student (and parent) roles;
 * individually chosen members can't be expressed there.
 */
export function legacyColumns(s: AudienceSpec): {
  targetAudiences: AudienceKey[];
  targetRoles: RoleKey[];
} {
  if (isEveryone(s)) return { targetAudiences: [], targetRoles: [] };
  const keys = new Set<AudienceKey>();
  for (const g of s.groups) {
    if (g.startsWith("TEACHER")) keys.add(AudienceKey.TEACHER);
    else if (g === "FORMER_STUDENT") {
      keys.add(AudienceKey.GRADUATE);
      keys.add(AudienceKey.LEFT_STUDENT);
    } else keys.add(g as AudienceKey);
  }
  if (s.cohortIds.length) {
    keys.add(AudienceKey.CURRENT_STUDENT);
    keys.add(AudienceKey.GRADUATE);
    keys.add(AudienceKey.LEFT_STUDENT);
    if (s.includeParents) {
      keys.add(AudienceKey.CURRENT_PARENT);
      keys.add(AudienceKey.FORMER_PARENT);
    }
  }
  const targetAudiences = [...keys];
  return { targetAudiences, targetRoles: rolesForAudiences(targetAudiences) };
}

export type AudienceViewer = {
  id: string;
  isAdmin: boolean;
  roles: readonly {
    role: RoleKey;
    didGraduate?: boolean | null;
    teacherStatus?: TeacherStatus | null;
    cohortId?: string | null;
  }[];
  /** 学年 of the member's children (parents) */
  childCohortIds: readonly string[];
};

/** The groups a member belongs to. Unknown graduation counts as both. */
export function groupsOfMember(v: AudienceViewer): AudienceGroup[] {
  const out = new Set<AudienceGroup>();
  for (const r of v.roles) {
    if (r.role === RoleKey.TEACHER)
      out.add(
        r.teacherStatus === TeacherStatus.FORMER
          ? "TEACHER_FORMER"
          : "TEACHER_CURRENT",
      );
    else if (r.role === RoleKey.FORMER_STUDENT) {
      out.add("FORMER_STUDENT");
      if (r.didGraduate !== false) out.add("GRADUATE");
      if (r.didGraduate !== true) out.add("LEFT_STUDENT");
    } else out.add(r.role as AudienceGroup);
  }
  return [...out];
}

/** Whether a member receives / may see a post (admins see everything). */
export function matchesAudience(s: AudienceSpec, v: AudienceViewer): boolean {
  if (v.isAdmin || isEveryone(s)) return true;
  if (s.userIds.includes(v.id)) return true;
  const groups = groupsOfMember(v);
  if (s.groups.some((g) => groups.includes(g))) return true;
  const own = v.roles
    .filter((r) => STUDENT_ROLES.includes(r.role) && r.cohortId)
    .map((r) => r.cohortId as string);
  if (s.cohortIds.some((c) => own.includes(c))) return true;
  if (
    s.includeParents &&
    v.roles.some((r) => PARENT_ROLES.includes(r.role)) &&
    s.cohortIds.some((c) => v.childCohortIds.includes(c))
  )
    return true;
  return false;
}

/**
 * Admins see every post; this says whether they're really in its audience.
 * Posts shown only because of admin rights are view-only: no read receipt,
 * no answers (「管理者として表示」).
 */
export function adminOnlyView(s: AudienceSpec, v: AudienceViewer): boolean {
  return v.isAdmin && !matchesAudience(s, { ...v, isAdmin: false });
}

/** DB filter for the members a post goes to (the caller adds state = ACTIVE). */
export function audienceUserWhere(s: AudienceSpec): Prisma.UserWhereInput {
  if (isEveryone(s)) return {};
  const or: Prisma.UserWhereInput[] = [];
  if (s.userIds.length) or.push({ id: { in: s.userIds } });
  const roleOr: Prisma.UserRoleWhereInput[] = [];
  for (const g of s.groups) {
    if (g === "TEACHER_CURRENT")
      roleOr.push({
        role: RoleKey.TEACHER,
        NOT: { teacherStatus: TeacherStatus.FORMER },
      });
    else if (g === "TEACHER_FORMER")
      roleOr.push({
        role: RoleKey.TEACHER,
        teacherStatus: TeacherStatus.FORMER,
      });
    else if (g === "FORMER_STUDENT")
      roleOr.push({ role: RoleKey.FORMER_STUDENT });
    else if (g === "GRADUATE")
      roleOr.push({
        role: RoleKey.FORMER_STUDENT,
        OR: [{ didGraduate: true }, { didGraduate: null }],
      });
    else if (g === "LEFT_STUDENT")
      roleOr.push({
        role: RoleKey.FORMER_STUDENT,
        OR: [{ didGraduate: false }, { didGraduate: null }],
      });
    else roleOr.push({ role: g as RoleKey });
  }
  if (s.cohortIds.length)
    roleOr.push({ role: { in: STUDENT_ROLES }, cohortId: { in: s.cohortIds } });
  if (roleOr.length) or.push({ roles: { some: { OR: roleOr } } });
  if (s.includeParents && s.cohortIds.length)
    or.push({
      roles: { some: { role: { in: PARENT_ROLES } } },
      parentLinks: {
        some: {
          OR: [
            { childCohortId: { in: s.cohortIds } },
            {
              child: {
                roles: {
                  some: {
                    role: { in: STUDENT_ROLES },
                    cohortId: { in: s.cohortIds },
                  },
                },
              },
            },
          ],
        },
      },
    });
  return { OR: or };
}
