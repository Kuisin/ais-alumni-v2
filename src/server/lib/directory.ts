import type { Prisma } from "@/server/generated/prisma/client";
import {
  AccountState,
  Division,
  LifeStage,
  RoleKey,
} from "@/server/generated/prisma/enums";
import {
  type MemberFilterKey,
  parseMemberFilter,
  roleRowWhere,
} from "@/server/lib/audience";
import {
  ADULT_AGE,
  blockedUserIds,
  canSeeInDirectory,
  type Viewer,
} from "@/server/lib/authz";
import { db } from "@/server/lib/db";
import { toKatakana } from "@/server/lib/names";

/**
 * Member directory (§10.1). Only public-tier columns are ever selected here;
 * private-tier fields (email, phone, LINE name, stage detail, social links)
 * must never be added to PUBLIC_CARD_SELECT (§15).
 */

export const DIRECTORY_PAGE_SIZE = 24;
export const MIN_YEAR = 1950;
export const MAX_YEAR = 2100;

/** 区分 shown when none is chosen: everyone who left AIS (卒業生＋元在校生). */
export const DEFAULT_DIRECTORY_ROLE: MemberFilterKey = RoleKey.FORMER_STUDENT;
/** ?role= value for 「すべての区分」 (no role filter). */
export const ALL_ROLES = "all";

/** Parents may leave the directory (User.hideFromDirectory). */
export const PARENT_ROLES: readonly RoleKey[] = [
  RoleKey.CURRENT_PARENT,
  RoleKey.FORMER_PARENT,
];

/** Public-tier columns for member cards (directory, follows, family lists). */
export const PUBLIC_CARD_SELECT = {
  id: true,
  nameRomaji: true,
  nameKanji: true,
  nameKana: true,
  nameAtAis: true,
  avatarUrl: true,
  // photo visibility (src/lib/avatar.ts)
  avatarPublic: true,
  familyId: true,
  gender: true,
  roles: {
    select: {
      role: true,
      yearsFrom: true,
      yearsTo: true,
      lastDivision: true,
      graduationOrLeaveYear: true,
      didGraduate: true,
      currentStage: true,
      currentGrade: true,
      cohortId: true,
      teacherStatus: true,
    },
  },
} as const satisfies Prisma.UserSelect;

export type PublicCard = Prisma.UserGetPayload<{
  select: typeof PUBLIC_CARD_SELECT;
}>;

export type DirectoryFilters = {
  q: string | null;
  /** 区分 (卒業生 / 元在校生 split; FORMER_STUDENT = both); null = all */
  role: MemberFilterKey | null;
  yearFrom: number | null;
  yearTo: number | null;
  division: Division | null;
  stage: LifeStage | null;
  /** 学年 (Cohort id) */
  cohort: string | null;
  cursor: string | null;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t ? t : null;
}

function oneOf<T extends string>(
  values: Record<string, T>,
  v: string | null,
): T | null {
  return v && (Object.values(values) as string[]).includes(v) ? (v as T) : null;
}

function year(v: string | null): number | null {
  if (!v || !/^\d{4}$/.test(v)) return null;
  const n = Number(v);
  return n >= MIN_YEAR && n <= MAX_YEAR ? n : null;
}

/** Parse GET searchParams into filters; invalid values are dropped. */
export function parseDirectoryFilters(params: RawParams): DirectoryFilters {
  const q = first(params.q)?.slice(0, 100) ?? null;
  let yearFrom = year(first(params.from));
  let yearTo = year(first(params.to));
  if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) {
    [yearFrom, yearTo] = [yearTo, yearFrom];
  }
  const cursor = first(params.cursor);
  const cohort = first(params.cohort);
  const role = first(params.role);
  return {
    q,
    role:
      role === ALL_ROLES
        ? null
        : (parseMemberFilter(role) ?? DEFAULT_DIRECTORY_ROLE),
    yearFrom,
    yearTo,
    division: oneOf(Division, first(params.division)),
    stage: oneOf(LifeStage, first(params.stage)),
    cohort: cohort && /^[a-z0-9]{10,40}$/i.test(cohort) ? cohort : null,
    // cuid ids only; anything else is ignored rather than sent to the DB.
    cursor: cursor && /^[a-z0-9]{10,40}$/i.test(cursor) ? cursor : null,
  };
}

/** Query string for the given filters (used by "Load more" / clear links). */
export function directoryQuery(
  f: DirectoryFilters,
  cursor: string | null = null,
): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.role !== DEFAULT_DIRECTORY_ROLE) p.set("role", f.role ?? ALL_ROLES);
  if (f.yearFrom !== null) p.set("from", String(f.yearFrom));
  if (f.yearTo !== null) p.set("to", String(f.yearTo));
  if (f.division) p.set("division", f.division);
  if (f.stage) p.set("stage", f.stage);
  if (f.cohort) p.set("cohort", f.cohort);
  if (cursor) p.set("cursor", cursor);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(f: DirectoryFilters): boolean {
  return Boolean(
    f.q ||
      f.role !== DEFAULT_DIRECTORY_ROLE ||
      f.yearFrom !== null ||
      f.yearTo !== null ||
      f.division ||
      f.stage ||
      f.cohort,
  );
}

/**
 * Latest date of birth that makes someone an adult today (UTC dates, matching
 * ageOn in authz/core). DOB <= cutoff ⇔ age >= 18.
 */
export function adultDobCutoff(now: Date): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear() - ADULT_AGE,
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
}

/** Tokens of a name search; each must match one of the name columns. */
export function nameTokens(q: string | null): string[] {
  if (!q) return [];
  return q.split(/\s+/).filter(Boolean).slice(0, 5);
}

/**
 * Prisma where-clause for the directory. The same minor/block rules are
 * re-checked in JS with canSeeInDirectory as defence in depth.
 */
export function buildDirectoryWhere(
  f: DirectoryFilters,
  ctx: { viewer: Viewer; blockedIds: string[]; now: Date },
): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [{ state: AccountState.ACTIVE }];

  if (ctx.blockedIds.length) and.push({ id: { notIn: ctx.blockedIds } });

  for (const token of nameTokens(f.q)) {
    and.push({
      OR: [
        { nameRomaji: { contains: token, mode: "insensitive" } },
        { nameKanji: { contains: token, mode: "insensitive" } },
        { nameAtAis: { contains: token, mode: "insensitive" } },
        { nameKana: { contains: toKatakana(token) } },
      ],
    });
  }

  // Role-specific filters apply to the same UserRole row, so "class of 2015,
  // high school, working" means one FORMER_STUDENT record matching all three.
  const roleWhere: Prisma.UserRoleWhereInput = {};
  if (f.role) Object.assign(roleWhere, roleRowWhere(f.role));
  if (f.yearFrom !== null || f.yearTo !== null) {
    roleWhere.graduationOrLeaveYear = {
      ...(f.yearFrom !== null ? { gte: f.yearFrom } : {}),
      ...(f.yearTo !== null ? { lte: f.yearTo } : {}),
    };
  }
  if (f.division) roleWhere.lastDivision = f.division;
  if (f.stage) roleWhere.currentStage = f.stage;
  if (f.cohort) roleWhere.cohortId = f.cohort;
  if (Object.keys(roleWhere).length) and.push({ roles: { some: roleWhere } });

  // Parents who chose to stay out of the directory (admins still see them).
  if (!ctx.viewer.isAdmin) {
    and.push({
      NOT: {
        hideFromDirectory: true,
        roles: { some: { role: { in: [...PARENT_ROLES] } } },
      },
    });
  }

  // Minors (§8): hidden unless the viewer is a teacher, an admin, or family.
  const v = ctx.viewer;
  if (!v.isAdmin && !v.currentTeacher) {
    const notMinor: Prisma.UserWhereInput = {
      AND: [
        { roles: { none: { role: RoleKey.CURRENT_STUDENT } } },
        { managedById: null },
        {
          OR: [
            { dateOfBirth: null },
            { dateOfBirth: { lte: adultDobCutoff(ctx.now) } },
          ],
        },
      ],
    };
    and.push(
      v.familyId ? { OR: [{ familyId: v.familyId }, notMinor] } : notMinor,
    );
  }

  return { AND: and };
}

export type DirectoryPage = {
  items: PublicCard[];
  nextCursor: string | null;
};

/**
 * One page of directory results. Cursor pagination on id with a stable
 * (nameRomaji, id) ordering.
 * Assumption: ACTIVE users always have nameRomaji (required at onboarding);
 * Prisma cursor comparisons on a NULL sort value would end the list early.
 */
export async function searchDirectory(
  viewer: Viewer,
  f: DirectoryFilters,
  now: Date = new Date(),
): Promise<DirectoryPage> {
  const blockedIds = await blockedUserIds(viewer.id);
  const rows = await db.user.findMany({
    where: buildDirectoryWhere(f, { viewer, blockedIds, now }),
    orderBy: [{ nameRomaji: "asc" }, { id: "asc" }],
    take: DIRECTORY_PAGE_SIZE + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    // Extra non-displayed columns are only for the canSeeInDirectory check.
    select: {
      ...PUBLIC_CARD_SELECT,
      state: true,
      dateOfBirth: true,
      familyId: true,
    },
  });
  const hasMore = rows.length > DIRECTORY_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, DIRECTORY_PAGE_SIZE) : rows;
  const blocked = new Set(blockedIds);
  const items: PublicCard[] = [];
  for (const r of page) {
    const target = {
      id: r.id,
      state: r.state,
      roles: r.roles.map((x) => x.role),
      dateOfBirth: r.dateOfBirth,
      familyId: r.familyId,
    };
    const rel = { follow: null, blocked: blocked.has(r.id) };
    if (!canSeeInDirectory(viewer, target, rel, now)) continue;
    items.push({
      id: r.id,
      nameRomaji: r.nameRomaji,
      nameKanji: r.nameKanji,
      nameKana: r.nameKana,
      nameAtAis: r.nameAtAis,
      avatarUrl: r.avatarUrl,
      avatarPublic: r.avatarPublic,
      familyId: r.familyId,
      gender: r.gender,
      roles: r.roles,
    });
  }
  return { items, nextCursor: hasMore ? page[page.length - 1].id : null };
}
