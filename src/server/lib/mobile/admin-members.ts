import type {
  AccountStateKey,
  AdminAuditEntry,
  AdminFamilyLink,
  AdminMemberDetail,
  AdminMemberList,
  AdminMemberPosition,
  AdminMemberRole,
  AdminMergeRequest,
  AdminMergeResult,
  AdminPositionKey,
  AdminResult,
  AdminRoleUpdate,
  LineStatus,
  RoleKeyName,
} from "@contract/admin-members";
import {
  type AdminMemberFormState,
  isRedirect,
  mergeMembersAction,
} from "@/server/app/actions/admin-members";
import type { Prisma } from "@/server/generated/prisma/client";
import {
  AccountState,
  PositionKey,
  RoleKey,
  TeacherStatus,
} from "@/server/generated/prisma/enums";
import { loadMessages } from "@/server/i18n/messages";
import { getTranslatorFor } from "@/server/i18n/translator";
import {
  MEMBER_FILTER_OPTIONS,
  parseMemberFilter,
  roleLabelKey,
  roleRowWhere,
} from "@/server/lib/audience";
import { isCurrentTeacher } from "@/server/lib/authz";
import { gradeLabel } from "@/server/lib/cohorts";
import {
  cohortNumbersById,
  cohortShortLabels,
  loadCohortChoices,
} from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import { MESSAGES_ENABLED } from "@/server/lib/features";
import { displayName, otherNames } from "@/server/lib/format";
import { roleFacts } from "@/server/lib/mobile/account";
import { type Locale, notFound } from "@/server/lib/mobile/http";
import { toKatakana } from "@/server/lib/names";
import { positionEligible } from "@/server/lib/permissions";
import type { CurrentUser } from "@/server/lib/session";

/**
 * 管理モード → 会員 for the app: the website's admin member list and detail
 * pages (src/app/[locale]/app/admin/(committee)/members), same queries and
 * rules. Callers check adminOnly() first, as the (committee) layout does;
 * the website's server actions (src/server/app/actions/admin-*.ts) keep
 * their own actionAdmin() guard.
 */

const PAGE_SIZE = 25;
const LINE_FILTERS = ["linked", "following", "unlinked"] as const;
type LineFilter = (typeof LINE_FILTERS)[number];

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | null {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function lineStatus(u: {
  lineUserId: string | null;
  lineFollowing: boolean;
}): LineStatus {
  return !u.lineUserId
    ? "notLinked"
    : u.lineFollowing
      ? "following"
      : "linkedNotFollowing";
}

const named = (u: { nameRomaji: string | null; nameKanji: string | null }) =>
  Boolean(u.nameRomaji || u.nameKanji);

export async function adminMemberList(
  query: Record<string, string>,
  locale: Locale,
): Promise<AdminMemberList> {
  const tr = await getTranslatorFor(locale, "roles");
  const roleLabel = (r: {
    role: RoleKey;
    teacherStatus: string | null;
    didGraduate: boolean | null;
  }) =>
    r.role === "TEACHER" && r.teacherStatus === "FORMER"
      ? `${tr("role.TEACHER")}（${tr("teacherStatusShort.FORMER")}）`
      : tr(roleLabelKey(r));

  const q = (query.q ?? "").trim().slice(0, 200);
  const state = pick(query.state, Object.values(AccountState));
  const role = parseMemberFilter(query.role);
  const line = pick<LineFilter>(query.line, LINE_FILTERS);
  const adminOnly = query.admin === "1";
  const cursor = query.cursor?.slice(0, 64) || null;

  const and: Prisma.UserWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { nameRomaji: { contains: q, mode: "insensitive" } },
        { nameKanji: { contains: q, mode: "insensitive" } },
        { nameAtAis: { contains: q, mode: "insensitive" } },
        { nameKana: { contains: toKatakana(q) } },
        { primaryEmail: { contains: q, mode: "insensitive" } },
        { id: q },
      ],
    });
  }
  if (state) and.push({ state });
  if (role) and.push({ roles: { some: roleRowWhere(role) } });
  if (line === "linked") and.push({ lineUserId: { not: null } });
  if (line === "following")
    and.push({ lineUserId: { not: null }, lineFollowing: true });
  if (line === "unlinked") and.push({ lineUserId: null });
  if (adminOnly) and.push({ isAdmin: true });
  const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        nameRomaji: true,
        nameKanji: true,
        nameKana: true,
        primaryEmail: true,
        state: true,
        isAdmin: true,
        lineUserId: true,
        lineFollowing: true,
        createdAt: true,
        roles: {
          select: { role: true, teacherStatus: true, didGraduate: true },
        },
      },
    }),
    db.user.count({ where }),
  ]);
  const hasMore = users.length > PAGE_SIZE;
  const page = users.slice(0, PAGE_SIZE);
  return {
    total,
    items: page.map((u) => ({
      id: u.id,
      name: named(u) ? displayName(u, locale) : null,
      otherName: otherNames(u),
      email: u.primaryEmail,
      state: u.state,
      stateLabel: tr(`state.${u.state}`),
      isAdmin: u.isAdmin,
      roles: u.roles.map(roleLabel),
      line: lineStatus(u),
      createdAt: u.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    filters: {
      states: Object.values(AccountState).map((s) => ({
        value: s,
        label: tr(`state.${s}`),
      })),
      roles: MEMBER_FILTER_OPTIONS.map((r) => ({
        value: r,
        label: tr(`audience.${r}`),
      })),
    },
  };
}

const AUDIT_LIMIT = 10;
const PERSON = {
  id: true,
  nameRomaji: true,
  nameKanji: true,
  nameKana: true,
} as const;

export async function adminMemberDetail(
  admin: CurrentUser,
  id: string,
  locale: Locale,
): Promise<AdminMemberDetail> {
  const user = await db.user.findUnique({
    where: { id },
    include: { roles: true, accounts: { select: { provider: true } } },
  });
  if (!user) throw notFound();
  const [tr, tp, ta] = await Promise.all([
    getTranslatorFor(locale, "roles"),
    getTranslatorFor(locale, "profile"),
    getTranslatorFor(locale, "adminMembers.roles"),
  ]);

  const [audits, linkRows, familyMembers, positions, cohortChoices] =
    await Promise.all([
      db.auditLog.findMany({
        where: { OR: [{ targetId: id }, { actorId: id }] },
        orderBy: { createdAt: "desc" },
        take: AUDIT_LIMIT,
        include: {
          actor: {
            select: {
              id: true,
              nameRomaji: true,
              nameKanji: true,
              primaryEmail: true,
            },
          },
        },
      }),
      db.familyLink.findMany({
        where: { OR: [{ parentId: user.id }, { childId: user.id }] },
        orderBy: { createdAt: "asc" },
        include: { parent: { select: PERSON }, child: { select: PERSON } },
      }),
      user.familyId
        ? db.user.findMany({
            where: { familyId: user.familyId, id: { not: user.id } },
            select: { id: true, nameRomaji: true, nameKanji: true },
          })
        : Promise.resolve([]),
      db.userPosition.findMany({
        where: { userId: user.id },
        select: { position: true, cohortId: true },
      }),
      loadCohortChoices(locale),
    ]);
  const [cohortNumbers, cohortLabels] = await Promise.all([
    cohortNumbersById(),
    cohortShortLabels(locale),
  ]);

  // 家族: direct links (as parent or child), and others in the same family.
  const person = (u: {
    id: string;
    nameRomaji: string | null;
    nameKanji: string | null;
    nameKana: string | null;
  }) => ({ id: u.id, name: displayName(u, locale), otherName: otherNames(u) });
  const links: AdminFamilyLink[] = linkRows.map((l) => {
    const asParent = l.childId === user.id;
    const other = asParent ? l.parent : l.child;
    return {
      id: l.id,
      as: asParent ? "parent" : "child",
      other: other ? person(other) : null,
      childName: l.childName,
      confirmed: l.confirmedAt !== null,
    };
  });
  const directIds = new Set(links.map((l) => l.other?.id));
  const relatives = familyMembers
    .filter((m) => !directIds.has(m.id))
    .map((m) => ({ id: m.id, name: displayName(m, locale) }));

  const roleOrder = Object.values(RoleKey);
  const roles = [...user.roles].sort(
    (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role),
  );
  const has = (keys: RoleKey[]) => roles.some((x) => keys.includes(x.role));
  // Add by type (student / parent / teacher); current vs former is derived.
  const addableRoles: RoleKeyName[] = [
    ...(has([RoleKey.CURRENT_STUDENT, RoleKey.FORMER_STUDENT])
      ? []
      : [RoleKey.CURRENT_STUDENT]),
    ...(has([RoleKey.CURRENT_PARENT, RoleKey.FORMER_PARENT])
      ? []
      : [RoleKey.CURRENT_PARENT]),
    ...(has([RoleKey.TEACHER]) ? [] : [RoleKey.TEACHER]),
  ];
  const cohortNo = (cohortId: string | null) =>
    cohortId ? (cohortNumbers.get(cohortId) ?? null) : null;
  const isStudentRole = (r: RoleKey) =>
    r === RoleKey.FORMER_STUDENT || r === RoleKey.CURRENT_STUDENT;

  const memberRoles: AdminMemberRole[] = roles.map((r) => {
    // The form's read-only 「自動で決まる項目」 (member-role-form.tsx).
    let derived: string | null = null;
    if (r.role === RoleKey.TEACHER)
      derived = tr(
        `teacherStatus.${r.teacherStatus === TeacherStatus.FORMER ? "FORMER" : "CURRENT"}`,
      );
    else if (r.role === RoleKey.CURRENT_STUDENT)
      derived = `${tr("role.CURRENT_STUDENT")}${r.currentGrade !== null ? ` · ${gradeLabel(r.currentGrade, locale)}` : ""}`;
    else if (
      r.role === RoleKey.FORMER_STUDENT &&
      r.graduationOrLeaveYear !== null
    )
      derived = r.didGraduate
        ? ta("derivedGraduated", { year: r.graduationOrLeaveYear })
        : ta("derivedLeft", { year: r.graduationOrLeaveYear });
    const former = r.role === RoleKey.FORMER_STUDENT;
    return {
      role: r.role,
      label: tr(roleLabelKey(r)),
      title: [
        tr(roleLabelKey(r)),
        former && r.graduationOrLeaveYear
          ? String(r.graduationOrLeaveYear)
          : null,
        former && r.currentStage ? tr(`stage.${r.currentStage}`) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      facts: roleFacts(r, locale, cohortLabels, tr, tp),
      subjects: r.role === RoleKey.TEACHER ? (r.subjects ?? null) : null,
      derived,
      stage: former
        ? r.currentStage
          ? `${tr(`stage.${r.currentStage}`)}${r.currentStageDetail ? `（${r.currentStageDetail}）` : ""}`
          : null
        : null,
      stageUpdatedAt:
        former && r.currentStageUpdatedAt
          ? r.currentStageUpdatedAt.toISOString()
          : null,
      values: {
        role: r.role,
        cohortNumber: cohortNo(r.cohortId),
        teacherStatus: r.teacherStatus,
        yearsFrom: r.yearsFrom,
        yearsTo: r.yearsTo,
        subjects: r.subjects,
        schoolEmail: r.schoolEmail,
        schoolEmailVerified: r.schoolEmailVerified,
        currentGrade: r.currentGrade,
        studentIdNo: r.studentIdNo,
        graduationOrLeaveYear: r.graduationOrLeaveYear,
        didGraduate: r.didGraduate,
        currentStage: r.currentStage,
        currentStageDetail: r.currentStageDetail,
      },
    };
  });

  // Positions (member-positions.tsx): suggested 学年 = their student 学年;
  // 学年代表 represent their own 学年 only.
  const studentCohorts = roles.filter(
    (r) => isStudentRole(r.role) && r.cohortId,
  );
  const defaultCohort = cohortNo(studentCohorts[0]?.cohortId ?? null);
  const ownCohorts = new Set(
    studentCohorts.map((r) => String(cohortNo(r.cohortId) ?? "")),
  );
  const cohorts = cohortChoices.map((c) => ({
    value: c.value,
    label: c.label,
  }));
  const repCohorts = cohorts.filter((c) => ownCohorts.has(c.value));
  const roleKeys = roles.map((r) => r.role);
  const memberPositions: AdminMemberPosition[] = Object.values(PositionKey)
    // 教職員担当 only sends お知らせ; 学年代表 also joins the 学年代表 chat.
    .filter((p) => MESSAGES_ENABLED || p !== PositionKey.TEACHER_MANAGER)
    .map((p) => {
      const held = positions.find((x) => x.position === p);
      return {
        position: p as AdminPositionKey,
        held: Boolean(held),
        cohortNumber: cohortNo(held?.cohortId ?? null),
        defaultCohortNumber: defaultCohort,
        eligible: positionEligible(p, roleKeys, isCurrentTeacher(roles)),
        // Only 学年代表 takes a 学年.
        cohorts: p === PositionKey.STUDENT_LEADER ? repCohorts : [],
      };
    });

  const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  return {
    id: user.id,
    name: named(user) ? displayName(user, locale) : null,
    otherName: otherNames(user),
    email: user.primaryEmail,
    emailVerified: Boolean(user.emailVerifiedAt),
    isAdmin: user.isAdmin,
    isSelf: user.id === admin.id,
    state: user.state as AccountStateKey,
    stateLabel: tr(`state.${user.state}`),
    roleLabels: roles.map((r) => tr(roleLabelKey(r))),
    line: { status: lineStatus(user), displayName: user.lineDisplayName },
    providers: [
      user.primaryEmail && user.emailVerifiedAt ? "email" : null,
      ...user.accounts.map((a) => a.provider),
    ].filter((p): p is string => Boolean(p)),
    notifyVia: user.notifyVia,
    createdAt: user.createdAt.toISOString(),
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
    profile: {
      lastNameRomaji: user.lastNameRomaji ?? "",
      firstNameRomaji: user.firstNameRomaji ?? "",
      middleNameRomaji: user.middleNameRomaji ?? "",
      lastNameKanji: user.lastNameKanji ?? "",
      firstNameKanji: user.firstNameKanji ?? "",
      lastNameKana: user.lastNameKana ?? "",
      firstNameKana: user.firstNameKana ?? "",
      nameAtAis: user.nameAtAis ?? "",
      dateOfBirth: dateOnly(user.dateOfBirth),
      bio: user.bio ?? "",
      phone: user.phone ?? "",
      gender: user.gender ?? "",
    },
    roles: memberRoles,
    addableRoles,
    cohorts,
    positions: memberPositions,
    family: { links, relatives },
    audit: await auditEntries(audits, locale),
  };
}

type AuditRow = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  data: Prisma.JsonValue | null;
  createdAt: Date;
  actor: {
    id: string;
    nameRomaji: string | null;
    nameKanji: string | null;
    primaryEmail: string | null;
  } | null;
};

type Person = {
  nameRomaji: string | null;
  nameKanji: string | null;
  primaryEmail: string | null;
};

/** Audit rows as the website's AuditList labels them (compact). */
async function auditEntries(
  rows: AuditRow[],
  locale: Locale,
): Promise<AdminAuditEntry[]> {
  const ta = await getTranslatorFor(locale, "audit");
  const audit = ((await loadMessages(locale)) as { audit?: unknown }).audit as
    | {
        actions?: Record<string, unknown>;
        targetTypes?: Record<string, unknown>;
      }
    | undefined;
  const dataUserId = (r: AuditRow) =>
    r.data &&
    typeof r.data === "object" &&
    !Array.isArray(r.data) &&
    typeof r.data.userId === "string"
      ? r.data.userId
      : null;
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.targetType === "User" && r.targetId) ids.add(r.targetId);
    const uid = dataUserId(r);
    if (uid) ids.add(uid);
  }
  const people = new Map<string, Person>(
    ids.size
      ? (
          await db.user.findMany({
            where: { id: { in: [...ids] } },
            select: {
              id: true,
              nameRomaji: true,
              nameKanji: true,
              primaryEmail: true,
            },
          })
        ).map((u) => [u.id, u])
      : [],
  );
  const label = (p: Person, id: string) =>
    p.nameRomaji || p.nameKanji
      ? displayName(p, locale)
      : (p.primaryEmail ?? id);
  return rows.map((r) => {
    const targetUserId =
      r.targetType === "User" && r.targetId ? r.targetId : dataUserId(r);
    const person = targetUserId ? people.get(targetUserId) : undefined;
    const type = r.targetType;
    return {
      id: r.id,
      action: r.action,
      label:
        typeof audit?.actions?.[r.action] === "string"
          ? ta(`actions.${r.action}`)
          : r.action,
      actor: r.actor ? label(r.actor, r.actor.id) : null,
      target:
        person && targetUserId
          ? label(person, targetUserId)
          : type
            ? typeof audit?.targetTypes?.[type] === "string"
              ? ta(`targetTypes.${type}`)
              : type
            : null,
      targetUserId: person ? targetUserId : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// Forms: the website's actions, given the FormData its forms post.
// ---------------------------------------------------------------------------

/** FormData from plain fields. */
export function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** An action's state as the API answers it. */
export function result(state: AdminMemberFormState): AdminResult {
  return {
    ...(state.ok !== undefined ? { ok: state.ok } : {}),
    ...(state.message ? { message: state.message } : {}),
    ...(state.error ? { error: state.error } : {}),
    ...(state.fieldErrors ? { fieldErrors: state.fieldErrors } : {}),
  };
}

export function roleForm(userId: string, b: AdminRoleUpdate): FormData {
  return formData({
    userId,
    role: b.role,
    cohortNumber: b.cohortNumber,
    yearsFrom: b.yearsFrom,
    yearsTo: b.yearsTo,
    subjects: b.subjects,
    schoolEmail: b.schoolEmail,
    studentIdNo: b.studentIdNo,
  });
}

/**
 * 統合: mergeMembersAction's preview / confirm. A finished merge redirects
 * to the kept account on the website; here that becomes `mergedInto`.
 */
export async function mergeMembers(
  userId: string,
  body: AdminMergeRequest,
): Promise<AdminMergeResult> {
  const fd =
    body.intent === "preview"
      ? formData({
          intent: "preview",
          userId,
          other: body.other,
          keep: body.keep,
        })
      : formData({
          intent: "confirm",
          keepId: body.keepId,
          duplicateId: body.duplicateId,
          ...(body.force ? { force: "on" } : {}),
        });
  try {
    const state = await mergeMembersAction({}, fd);
    return {
      ...result(state),
      ...(state.preview ? { preview: state.preview } : {}),
      ...(state.blocked ? { blocked: state.blocked } : {}),
    };
  } catch (e) {
    if (isRedirect(e) && body.intent === "confirm")
      return { ok: true, mergedInto: body.keepId };
    throw e;
  }
}
