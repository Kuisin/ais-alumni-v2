import type {
  AdminDetailRow,
  VerificationActionResult,
  VerificationAnswerSection,
  VerificationChildCard,
  VerificationDetail,
  VerificationQueue,
  VerificationTab,
  VoucherCandidate,
} from "@contract/admin";
import { getTranslations } from "next-intl/server";
import {
  addVoucherAction,
  decideVerificationAction,
  mergeManagedIntoApplicantAction,
} from "@/server/app/actions/admin-verify";
import { RoleKey, VerificationStatus } from "@/server/generated/prisma/enums";
import { roleLabelKey } from "@/server/lib/audience";
import { isMinor } from "@/server/lib/authz/core";
import {
  cohortLabel,
  cohortShort,
  elementaryEndFor,
  gradeLabel,
} from "@/server/lib/cohorts";
import { db } from "@/server/lib/db";
import { displayName, TIME_ZONE } from "@/server/lib/format";
import {
  INVITE_OF_USER_SELECT,
  inviteMatches,
  inviteOfUser,
} from "@/server/lib/invites";
import { adminOnly } from "@/server/lib/mobile/admin";
import { type Locale, notFound } from "@/server/lib/mobile/http";
import { composeKanji, composeRomaji } from "@/server/lib/names";
import { findManagedMatches } from "@/server/lib/parent-onboarding";
import { isCurrentTeacher, studentStatus } from "@/server/lib/school";
import type { CurrentUser } from "@/server/lib/session";
import { signedFileUrl } from "@/server/lib/storage";
import { matchStudentRoster } from "@/server/lib/verification/match";
import { ROSTER_MATCH_THRESHOLD } from "@/server/lib/verification/roster";
import { findMembersByName } from "@/server/lib/verification/vouch";

/**
 * 本人確認 for the app: the website's committee pages
 * /app/admin/verification (queue) and /app/admin/verification/[id]
 * (application and decision), same queries and the same checks —
 * requireAdmin for the pages; the actions (src/server/app/actions/
 * admin-verify.ts) check actionAdmin themselves.
 */

const PAGE_SIZE = 20;

/** ?page= as the website's pageParam: a positive integer, default 1. */
function pageParam(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

// The website's admin-format.ts (src/components/admin).

/** Compact date for dense admin lists: ja → 2026/09/27, en → Sep 27, 2026 */
function formatCompactDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: locale === "ja" ? "2-digit" : "short",
    day: locale === "ja" ? "2-digit" : "numeric",
  }).format(date);
}

/** How long ago: ja → 3日前 / 5時間前, en → 3 days ago / 5 hours ago */
function formatAge(date: Date, locale: Locale, now: Date = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round((date.getTime() - now.getTime()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 60) return rtf.format(days, "day");
  return rtf.format(Math.round(days / 30), "month");
}

// ---------------------------------------------------------------------------
// Queue

export async function verificationQueue(
  user: CurrentUser,
  params: { tab?: string; q?: string; page?: string },
  locale: Locale,
): Promise<VerificationQueue> {
  adminOnly(user);
  const status =
    params.tab === "needsInfo"
      ? VerificationStatus.NEEDS_INFO
      : VerificationStatus.PENDING;
  const page = pageParam(params.page);
  const q = (params.q ?? "").trim().slice(0, 60);
  // Parents alone aren't reviewed: they follow their children's approval.
  const where = {
    status,
    followsChildren: false,
    ...(q
      ? {
          user: {
            OR: [
              { nameRomaji: { contains: q, mode: "insensitive" as const } },
              { nameKanji: { contains: q } },
            ],
          },
        }
      : {}),
  };

  const [requests, counts] = await Promise.all([
    db.verificationRequest.findMany({
      where,
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        submittedAt: true,
        rosterScore: true,
        answers: true,
        user: {
          select: {
            ...INVITE_OF_USER_SELECT,
            nameRomaji: true,
            nameKanji: true,
            dateOfBirth: true,
            managedBy: { select: { nameRomaji: true, nameKanji: true } },
            roles: { select: { role: true, schoolEmailVerified: true } },
            parentLinks: {
              select: {
                childName: true,
                child: {
                  select: {
                    roles: {
                      where: { cohortId: { not: null } },
                      select: { cohort: { select: { number: true } } },
                      take: 1,
                    },
                  },
                },
              },
            },
            childLinks: {
              where: { confirmedAt: { not: null } },
              select: { id: true },
              take: 1,
            },
          },
        },
        vouches: { select: { answer: true } },
        _count: { select: { evidence: true } },
        evidence: { where: { kind: "DIPLOMA" }, select: { id: true } },
      },
    }),
    db.verificationRequest.groupBy({
      by: ["status"],
      where: {
        status: {
          in: [VerificationStatus.PENDING, VerificationStatus.NEEDS_INFO],
        },
        followsChildren: false,
      },
      _count: { _all: true },
    }),
  ]);
  const countOf = (s: VerificationStatus) =>
    counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = q
    ? await db.verificationRequest.count({ where })
    : countOf(status);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date();

  return {
    tab: (status === VerificationStatus.NEEDS_INFO
      ? "needsInfo"
      : "pending") satisfies VerificationTab,
    q,
    page,
    pages,
    counts: {
      pending: countOf(VerificationStatus.PENDING),
      needsInfo: countOf(VerificationStatus.NEEDS_INFO),
    },
    items: requests.map((r) => {
      const roles = r.user.roles.map((x) => x.role);
      const minor = isMinor({ roles, dateOfBirth: r.user.dateOfBirth });
      const tally = { YES: 0, NO: 0, NOT_SURE: 0, pending: 0 };
      for (const v of r.vouches) tally[v.answer ?? "pending"]++;
      const inv = inviteOfUser(r.user);
      return {
        id: r.id,
        name: displayName(r.user, locale),
        roles,
        registeredBy: r.user.managedBy
          ? displayName(r.user.managedBy, locale)
          : null,
        children: r.user.parentLinks.length
          ? r.user.parentLinks
              .map((l) => {
                const n = l.child?.roles[0]?.cohort?.number;
                return `${l.childName ?? "—"}${n ? `（${cohortShort({ number: n }, locale)}）` : ""}`;
              })
              .join("、")
          : null,
        submittedAt: r.submittedAt.toISOString(),
        submittedDate: formatCompactDate(r.submittedAt, locale),
        age: formatAge(r.submittedAt, locale, now),
        invite: inv
          ? {
              grade: inv.kind === "GRADE",
              mismatch:
                inviteMatches(
                  { type: inv.type, cohortNumber: inv.cohort?.number ?? null },
                  r.answers,
                ) === "mismatch",
            }
          : null,
        rosterScore: r.rosterScore,
        rosterMatch:
          r.rosterScore !== null && r.rosterScore >= ROSTER_MATCH_THRESHOLD,
        vouches: {
          total: r.vouches.length,
          yes: tally.YES,
          no: tally.NO,
          unsure: tally.NOT_SURE,
          pending: tally.pending,
        },
        diploma: r.evidence.length > 0,
        evidence: r._count.evidence,
        schoolEmail: r.user.roles.some((x) => x.schoolEmailVerified),
        minor,
        parentConfirmed: r.user.childLinks.length > 0,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Application

export async function verificationDetail(
  user: CurrentUser,
  id: string,
  locale: Locale,
): Promise<VerificationDetail> {
  adminOnly(user);
  const request = await db.verificationRequest.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          roles: true,
          childLinks: {
            include: {
              parent: { select: { nameRomaji: true, nameKanji: true } },
            },
          },
          parentLinks: {
            select: {
              id: true,
              childName: true,
              childId: true,
              confirmedAt: true,
            },
          },
          ...INVITE_OF_USER_SELECT,
        },
      },
      reviewer: { select: { nameRomaji: true, nameKanji: true } },
      evidence: { orderBy: { createdAt: "asc" } },
      vouches: {
        orderBy: { askedAt: "asc" },
        include: {
          voucher: { select: { id: true, nameRomaji: true, nameKanji: true } },
        },
      },
    },
  });
  if (!request) throw notFound();
  const applicant = request.user;
  const invite = inviteOfUser(applicant);
  const ti = await getTranslations({ locale, namespace: "invites" });

  const roles = applicant.roles.map((r) => r.role);
  const minor = isMinor({ roles, dateOfBirth: applicant.dateOfBirth });
  const teacher = applicant.roles.find((r) => r.role === RoleKey.TEACHER);
  const open = request.status === VerificationStatus.PENDING;
  const isParent = applicant.roles.some(
    (r) =>
      r.role === RoleKey.CURRENT_PARENT || r.role === RoleKey.FORMER_PARENT,
  );

  const [rosterRow, next, duplicates, children, answers] = await Promise.all([
    request.rosterRowId
      ? db.rosterEntry.findUnique({ where: { id: request.rosterRowId } })
      : null,
    // Decided: offer the next application in the queue (oldest first).
    open
      ? null
      : db.verificationRequest.findFirst({
          where: {
            status: VerificationStatus.PENDING,
            followsChildren: false,
            id: { not: request.id },
          },
          orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
          select: { id: true },
        }),
    findManagedMatches(
      {
        names: [applicant.nameRomaji, applicant.nameKanji, applicant.nameAtAis],
        dateOfBirth: applicant.dateOfBirth,
      },
      applicant.id,
    ),
    isParent ? childrenReview(applicant.id, locale) : null,
    answersView(request.answers, locale),
  ]);

  return {
    id: request.id,
    applicantId: applicant.id,
    name: displayName(applicant, locale),
    status: request.status,
    submittedAt: request.submittedAt.toISOString(),
    open,
    canAddVoucher: open || request.status === VerificationStatus.NEEDS_INFO,
    nextId: next?.id ?? null,
    schoolEmailVerified: Boolean(teacher?.schoolEmailVerified),
    minor,
    parentConfirmed: applicant.childLinks.some((l) => l.confirmedAt),
    lastDecision:
      request.reviewNote || request.decidedAt
        ? {
            decidedAt: request.decidedAt?.toISOString() ?? null,
            reviewer: request.reviewer
              ? displayName(request.reviewer, locale)
              : null,
            note: request.reviewNote,
          }
        : null,
    account: {
      email: applicant.primaryEmail,
      state: applicant.state,
      dateOfBirth: applicant.dateOfBirth?.toISOString() ?? null,
      schoolEmail: teacher?.schoolEmail
        ? {
            address: teacher.schoolEmail,
            verified: Boolean(teacher.schoolEmailVerified),
          }
        : null,
      parents: applicant.childLinks.map((l) => ({
        name: displayName(l.parent, locale),
        confirmed: Boolean(l.confirmedAt),
      })),
      children: applicant.parentLinks.map((l) => ({
        name: l.childName ?? "—",
        linked: Boolean(l.childId),
      })),
    },
    invite: invite
      ? {
          kind: invite.kind === "GRADE" ? "GRADE" : "INDIVIDUAL",
          uses: invite._count.uses,
          maxUses: invite.maxUses,
          inviterId: invite.inviter.id,
          inviterName: displayName(invite.inviter, locale),
          createdAt: invite.createdAt.toISOString(),
          said: `${ti(`types.${invite.type}`)}${invite.cohort ? `（${cohortShort(invite.cohort, locale)}）` : ""}`,
          inviteeName: invite.inviteeName,
          match: inviteMatches(
            { type: invite.type, cohortNumber: invite.cohort?.number ?? null },
            request.answers,
          ),
        }
      : null,
    managedDuplicates: duplicates.map((m) => ({
      id: m.id,
      name: displayName(m, locale),
      registeredBy: m.managedBy ? displayName(m.managedBy, locale) : "—",
    })),
    children,
    answers,
    roster:
      request.rosterScore === null
        ? null
        : {
            score: request.rosterScore,
            match: request.rosterScore >= ROSTER_MATCH_THRESHOLD,
            row: rosterRow
              ? {
                  nameRomaji: rosterRow.nameRomaji,
                  nameKanji: rosterRow.nameKanji,
                  dateOfBirth: rosterRow.dateOfBirth
                    ? rosterRow.dateOfBirth.toISOString().slice(0, 10)
                    : null,
                  years: `${rosterRow.yearsFrom ?? "?"}–${rosterRow.yearsTo ?? "?"}`,
                  kind: rosterRow.kind,
                  claimed: rosterRow.claimedByUserId
                    ? rosterRow.claimedByUserId === applicant.id
                      ? "applicant"
                      : "other"
                    : null,
                }
              : null,
          },
    vouches: request.vouches.map((v) => ({
      id: v.id,
      name: displayName(v.voucher, locale),
      answer: v.answer,
      at: (v.answeredAt ?? v.askedAt).toISOString(),
    })),
    evidence: request.evidence.map((e) => ({
      id: e.id,
      fileName: e.fileName,
      mimeType: e.mimeType,
      size: e.size,
      diploma: e.kind === "DIPLOMA",
      deleteAfter: e.deleteAfter?.toISOString() ?? null,
      url: signedFileUrl(e.storageKey, undefined, e.fileName),
    })),
  };
}

const STUDENT_ROLES: RoleKey[] = [
  RoleKey.CURRENT_STUDENT,
  RoleKey.FORMER_STUDENT,
];

/**
 * A parent's children as the committee checks them (the website's
 * ChildrenReview): details, where each came from and the link's state.
 */
async function childrenReview(
  parentId: string,
  locale: Locale,
): Promise<VerificationChildCard[]> {
  const tr = await getTranslations({ locale, namespace: "roles" });
  const links = await db.familyLink.findMany({
    where: { parentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      childName: true,
      confirmedAt: true,
      child: {
        select: {
          id: true,
          state: true,
          managedById: true,
          nameRomaji: true,
          nameKanji: true,
          dateOfBirth: true,
          roles: {
            where: { role: { in: STUDENT_ROLES } },
            select: {
              role: true,
              didGraduate: true,
              currentGrade: true,
              yearsFrom: true,
              yearsTo: true,
              graduationOrLeaveYear: true,
              studentIdNo: true,
              cohort: { select: { number: true, elementaryEndYear: true } },
            },
          },
        },
      },
    },
  });
  return Promise.all(
    links.map(async (l): Promise<VerificationChildCard> => {
      const c = l.child;
      const role = c?.roles[0];
      const createdHere = c?.managedById === parentId;
      const match =
        c && createdHere
          ? await matchStudentRoster({
              nameRomaji: c.nameRomaji ?? "",
              nameKanji: c.nameKanji,
              dateOfBirth: c.dateOfBirth,
              yearsFrom: role?.yearsFrom ?? null,
              yearsTo: role?.yearsTo ?? null,
            })
          : null;
      return {
        linkId: l.id,
        childId: c?.id ?? null,
        name: c
          ? [c.nameKanji, c.nameRomaji].filter(Boolean).join(" / ") ||
            (l.childName ?? "—")
          : (l.childName ?? "—"),
        source:
          c === null ? "nameOnly" : createdHere ? "created" : "registered",
        link: l.confirmedAt
          ? "confirmed"
          : c && (createdHere || c.managedById)
            ? "onApproval"
            : c
              ? "childToConfirm"
              : null,
        details: c
          ? {
              dateOfBirth: c.dateOfBirth?.toISOString() ?? null,
              cohort: role?.cohort
                ? cohortLabel(
                    {
                      number: role.cohort.number,
                      elementaryEndYear: role.cohort.elementaryEndYear,
                    },
                    locale,
                  )
                : null,
              status: role
                ? `${tr(roleLabelKey(role))}${
                    role.role === RoleKey.CURRENT_STUDENT &&
                    role.currentGrade !== null
                      ? `（${gradeLabel(role.currentGrade, locale)}）`
                      : role.graduationOrLeaveYear
                        ? `（${role.graduationOrLeaveYear}）`
                        : ""
                  }`
                : null,
              years: `${role?.yearsFrom ?? "?"}–${role?.yearsTo ?? ""}`,
              studentId: role?.studentIdNo ?? null,
              roster: createdHere
                ? {
                    score: match?.score ?? null,
                    match:
                      match !== null && match.score >= ROSTER_MATCH_THRESHOLD,
                  }
                : null,
            }
          : null,
      };
    }),
  );
}

// The website's AnswersView: VerificationRequest.answers (sign-up wizard,
// version 2) as labelled rows; lenient, as the JSON may be partial.
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null =>
  typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null;
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

async function answersView(
  answers: unknown,
  locale: Locale,
): Promise<VerificationAnswerSection[] | null> {
  const a = obj(answers);
  if (a.version !== 2) return null;
  const t = await getTranslations({ locale, namespace: "verify" });
  const ta = await getTranslations({ locale, namespace: "adminVerify" });
  const student = obj(a.student);
  const teacher = obj(a.teacher);
  const children = arr(obj(a.parent).children).map(obj);

  const rows = (...items: [string, string | null | undefined][]) =>
    items
      .filter((i): i is [string, string] => Boolean(i[1]))
      .map(([label, value]): AdminDetailRow => ({ label, value }));
  const classLabel = (n: unknown) =>
    typeof n === "number"
      ? cohortLabel(
          { number: n, elementaryEndYear: elementaryEndFor(n) },
          locale,
        )
      : null;
  const statusOf = (n: unknown, left: unknown): string | null => {
    if (typeof n !== "number") return null;
    const st = studentStatus(elementaryEndFor(n), num(left));
    if (st.current)
      return st.currentGrade !== null
        ? t("preview.current", { grade: gradeLabel(st.currentGrade, locale) })
        : t("preview.upcoming");
    return st.didGraduate
      ? t("preview.graduated", { year: st.graduationOrLeaveYear ?? "" })
      : t("preview.left", { year: st.graduationOrLeaveYear ?? "" });
  };
  const years = (s: Obj) => {
    const from = str(s.joinedYear);
    return from ? `${from}–${str(s.leftYear) ?? ""}` : null;
  };

  const sections: VerificationAnswerSection[] = [
    {
      title: ta("detail.basics"),
      rows: rows(
        [
          t("fields.nameRomaji"),
          composeRomaji({
            lastNameRomaji: str(a.lastNameRomaji),
            firstNameRomaji: str(a.firstNameRomaji),
            middleNameRomaji: str(a.middleNameRomaji),
          }),
        ],
        [
          t("fields.nameKanji"),
          composeKanji({
            lastNameKanji: str(a.lastNameKanji),
            firstNameKanji: str(a.firstNameKanji),
          }),
        ],
        [t("fields.nameAtAis"), str(a.nameAtAis)],
        [t("fields.dateOfBirth"), str(a.dateOfBirth)],
        [
          t("review.types"),
          arr(a.types)
            .map((x) => t(`types.${String(x)}.title`))
            .join("・"),
        ],
        [
          t("diploma.title"),
          a.diplomaUnavailable === true ? t("diploma.unavailable") : null,
        ],
        [t("fields.locale"), a.locale === "en" ? "English" : "日本語"],
      ),
    },
  ];

  if (Object.keys(student).length)
    sections.push({
      title: t("types.STUDENT.title"),
      rows: rows(
        [t("fields.cohort"), classLabel(student.cohortNumber)],
        [ta("detail.years"), years(student)],
        [ta("detail.status"), statusOf(student.cohortNumber, student.leftYear)],
        [t("fields.homeroomTeacher"), str(student.homeroomTeacher)],
        [t("fields.studentIdNo"), str(student.studentIdNo)],
        [
          t("fields.classmates"),
          arr(student.classmates).map(String).join("、"),
        ],
      ),
    });

  if (children.length)
    sections.push({
      title: t("types.PARENT.title"),
      rows: [],
      items: children.map((c) =>
        rows(
          [
            t("fields.childName"),
            c.mode === "new"
              ? [
                  composeKanji({
                    lastNameKanji: str(c.lastNameKanji),
                    firstNameKanji: str(c.firstNameKanji),
                  }),
                  composeRomaji({
                    lastNameRomaji: str(c.lastNameRomaji),
                    firstNameRomaji: str(c.firstNameRomaji),
                    middleNameRomaji: null,
                  }),
                ]
                  .filter(Boolean)
                  .join(" / ")
              : str(c.name),
          ],
          [
            ta("children.source.title"),
            c.mode === "existing"
              ? ta("children.source.registered")
              : c.mode === "new"
                ? ta("children.source.created")
                : ta("children.source.nameOnly"),
          ],
          [ta("children.dob"), str(c.dateOfBirth)],
          [t("fields.cohort"), classLabel(c.cohortNumber)],
          [ta("detail.years"), years(c)],
          [ta("detail.status"), statusOf(c.cohortNumber, c.leftYear)],
          [ta("children.studentId"), str(c.studentIdNo)],
        ),
      ),
    });

  if (Object.keys(teacher).length)
    sections.push({
      title: t("types.TEACHER.title"),
      rows: rows(
        [ta("detail.years"), years(teacher)],
        [
          ta("detail.status"),
          isCurrentTeacher(num(teacher.leftYear))
            ? t("preview.teacherCurrent")
            : t("preview.teacherFormer", {
                year: str(teacher.leftYear) ?? "",
              }),
        ],
        [t("fields.subjects"), str(teacher.subjects)],
        [t("fields.schoolEmail"), str(teacher.schoolEmail)],
      ),
    });

  return sections;
}

// ---------------------------------------------------------------------------
// Vouchers: search and ask

export async function voucherCandidates(
  user: CurrentUser,
  id: string,
  rawQ: string | undefined,
  locale: Locale,
): Promise<VoucherCandidate[]> {
  adminOnly(user);
  const q = rawQ?.trim().slice(0, 100) ?? "";
  const request = await db.verificationRequest.findUnique({
    where: { id },
    select: { userId: true, vouches: { select: { voucherId: true } } },
  });
  if (!request) throw notFound();
  if (!q) return [];
  const found = await findMembersByName(q, {
    threshold: 0.5,
    limit: 10,
    excludeUserIds: [
      request.userId,
      ...request.vouches.map((v) => v.voucherId),
    ],
  });
  return found.map((c) => ({
    id: c.id,
    name: displayName(c, locale),
    nameRomaji: c.nameRomaji,
  }));
}

// ---------------------------------------------------------------------------
// Actions: the website's server actions, given the form it would post.

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

export async function decideVerification(
  user: CurrentUser,
  id: string,
  body: { decision: string; note?: string },
): Promise<VerificationActionResult> {
  adminOnly(user);
  const result = await decideVerificationAction(
    null,
    form({
      requestId: id,
      decision: body.decision,
      ...(body.note !== undefined ? { note: body.note } : {}),
    }),
  );
  return result ?? { ok: false, message: "generic" };
}

export async function addVoucher(
  user: CurrentUser,
  id: string,
  voucherId: string,
): Promise<VerificationActionResult> {
  adminOnly(user);
  const result = await addVoucherAction(
    null,
    form({ requestId: id, voucherId }),
  );
  return result ?? { ok: false, message: "generic" };
}

export async function mergeManagedIntoApplicant(
  user: CurrentUser,
  id: string,
  managedId: string,
): Promise<{ ok: true }> {
  adminOnly(user);
  // The website's action returns nothing: it merges only an actual match.
  await mergeManagedIntoApplicantAction(form({ requestId: id, managedId }));
  return { ok: true };
}
