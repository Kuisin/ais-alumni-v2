import type { Prisma } from "@/server/generated/prisma/client";
import {
  AccountState,
  FamilyLinkInitiator,
  RoleKey,
  VerificationStatus,
} from "@/server/generated/prisma/enums";
import { cohortShort } from "@/server/lib/cohorts";
import { ensureCohort } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import {
  confirmLinkInTx,
  exactNameMatch,
  normalizeName,
} from "@/server/lib/family";
import { displayName } from "@/server/lib/format";
import { childIsCurrent, studentRoleFields } from "@/server/lib/member-status";
import { nameColumns } from "@/server/lib/names";
import { NOTIFY_USER_SELECT, notify } from "@/server/lib/notify";
import type { CurrentUser } from "@/server/lib/session";
import { syncMemberStatus } from "@/server/lib/status-sync";
import type { ChildData } from "@/server/lib/verification/schema";

/**
 * Parents at sign-up (§6.2, §8). Each child is either
 *  - already registered: found by exact name + birth date (no browsing of
 *    members by applicants) and linked; the child confirms the link, or —
 *    when the child's account is managed by another parent — the admin's
 *    approval does; or
 *  - new: the parent enters the child's details and a child account managed
 *    by the parent is created (no sign-in of its own, PENDING_REVIEW).
 * Admins review students and teachers, not parents: each new child gets its
 * own application (a student one) in the queue, and a parent-only
 * application (followsChildren) is approved as soon as one linked child is
 * approved and the link confirmed (settleParentFromChildren). A question
 * about a child goes back to the parent; if every child is rejected, so is
 * the parent.
 */

type Tx = Prisma.TransactionClient;

const STUDENT_ROLES = [RoleKey.CURRENT_STUDENT, RoleKey.FORMER_STUDENT];
const OPEN_OR_APPROVED = [
  AccountState.PENDING_REVIEW,
  AccountState.NEEDS_INFO,
  AccountState.ACTIVE,
];

export type RegisteredChild = {
  id: string;
  name: string;
  cohort: string | null;
};

/** Registered students with exactly this name and birth date (max 3). */
export async function findRegisteredChildren(
  q: { name: string; dateOfBirth: string },
  excludeUserId: string,
  locale: "ja" | "en",
): Promise<RegisteredChild[]> {
  const name = normalizeName(q.name);
  if (name.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(q.dateOfBirth)) return [];
  const dob = new Date(`${q.dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return [];
  const candidates = await db.user.findMany({
    where: {
      id: { not: excludeUserId },
      dateOfBirth: dob,
      state: { in: [AccountState.ACTIVE, AccountState.PENDING_REVIEW] },
      roles: { some: { role: { in: STUDENT_ROLES } } },
    },
    select: {
      id: true,
      nameRomaji: true,
      nameKanji: true,
      nameAtAis: true,
      roles: {
        where: { role: { in: STUDENT_ROLES } },
        select: { cohort: { select: { number: true } } },
      },
    },
    // Everyone born that day, then the exact name match: a small cap here
    // could drop the right person before the name check.
    take: 2000,
  });
  return candidates
    .filter((u) => exactNameMatch(q.name, u))
    .slice(0, 3)
    .map((u) => {
      const n = u.roles.find((r) => r.cohort)?.cohort?.number;
      return {
        id: u.id,
        name: displayName(u, locale),
        cohort: n ? cohortShort({ number: n }, locale) : null,
      };
    });
}

type ChildRole = { end: number; leftYear: number | null } | null;

/** A registered child's student record (学年 end year and leave year). */
async function registeredChildRole(
  tx: Tx,
  childId: string,
): Promise<ChildRole> {
  const r = await tx.userRole.findFirst({
    where: {
      userId: childId,
      role: { in: STUDENT_ROLES },
      cohortId: { not: null },
    },
    select: { yearsTo: true, cohort: { select: { elementaryEndYear: true } } },
  });
  return r?.cohort
    ? { end: r.cohort.elementaryEndYear, leftYear: r.yearsTo }
    : null;
}

/** Whether each child is a current student (for the parent's own role). */
export async function childrenCurrent(
  tx: Tx,
  children: readonly ChildData[],
  now: Date = new Date(),
): Promise<boolean[]> {
  const out: boolean[] = [];
  for (const c of children) {
    if (c.mode === "new") {
      const id = await ensureCohort(c.cohortNumber, tx);
      const { elementaryEndYear } = await tx.cohort.findUniqueOrThrow({
        where: { id },
        select: { elementaryEndYear: true },
      });
      out.push(childIsCurrent(elementaryEndYear, c.leftYear, now));
    } else {
      const r = await registeredChildRole(tx, c.existingUserId);
      if (r) out.push(childIsCurrent(r.end, r.leftYear, now));
    }
  }
  return out;
}

const dayKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * Save the children of a parent's application (also on resubmission).
 * Returns links to registered children that the child must confirm.
 */
export async function saveParentChildren(
  tx: Tx,
  parent: CurrentUser,
  children: readonly ChildData[],
  locale: "ja" | "en",
  now: Date = new Date(),
): Promise<string[]> {
  let familyId = parent.familyId;
  if (!familyId) {
    familyId = (await tx.family.create({ data: {} })).id;
    await tx.user.update({ where: { id: parent.id }, data: { familyId } });
  }

  const managed = await tx.user.findMany({
    where: { managedById: parent.id, state: { in: OPEN_OR_APPROVED } },
    select: { id: true, nameRomaji: true, dateOfBirth: true, state: true },
  });
  const managedKey = (name: string | null, dob: Date | null) =>
    `${normalizeName(name ?? "")}|${dayKey(dob)}`;
  const managedByKey = new Map(
    managed.map((m) => [managedKey(m.nameRomaji, m.dateOfBirth), m]),
  );

  const keptChildIds = new Set<string>();
  const toConfirm: string[] = [];

  for (const c of children) {
    let childId: string;
    let childName: string;
    let childCohortId: string | null = null;
    let childLeftYear: number | null = null;

    if (c.mode === "new") {
      const cols = nameColumns({
        lastNameRomaji: c.lastNameRomaji,
        firstNameRomaji: c.firstNameRomaji,
        middleNameRomaji: null,
        lastNameKanji: c.lastNameKanji,
        firstNameKanji: c.firstNameKanji,
        lastNameKana: c.lastNameKana,
        firstNameKana: c.firstNameKana,
      });
      const dob = new Date(`${c.dateOfBirth}T00:00:00Z`);
      childCohortId = await ensureCohort(c.cohortNumber, tx);
      childLeftYear = c.leftYear;
      const existing = managedByKey.get(managedKey(cols.nameRomaji, dob));
      const data = { ...cols, dateOfBirth: dob, familyId, locale };
      if (existing?.state === AccountState.ACTIVE) {
        // Already approved: its details are settled; keep the link only.
        keptChildIds.add(existing.id);
        continue;
      }
      childId = existing
        ? (
            await tx.user.update({
              where: { id: existing.id },
              data: { ...data, state: AccountState.PENDING_REVIEW },
              select: { id: true },
            })
          ).id
        : (
            await tx.user.create({
              data: {
                ...data,
                state: AccountState.PENDING_REVIEW,
                managedById: parent.id,
              },
              select: { id: true },
            })
          ).id;
      const { elementaryEndYear } = await tx.cohort.findUniqueOrThrow({
        where: { id: childCohortId },
        select: { elementaryEndYear: true },
      });
      const { role, ...fields } = studentRoleFields(
        elementaryEndYear,
        c.joinedYear,
        c.leftYear,
        now,
      );
      await tx.userRole.deleteMany({
        where: { userId: childId, role: { in: STUDENT_ROLES, not: role } },
      });
      await tx.userRole.upsert({
        where: { userId_role: { userId: childId, role } },
        create: {
          userId: childId,
          role,
          ...fields,
          cohortId: childCohortId,
          studentIdNo: c.studentIdNo,
        },
        update: {
          ...fields,
          cohortId: childCohortId,
          studentIdNo: c.studentIdNo,
        },
      });
      childName = cols.nameKanji ?? cols.nameRomaji ?? c.lastNameRomaji;
      // The child's own (student) application, reviewed by the admins.
      const answers = {
        version: 2,
        types: ["STUDENT"],
        lastNameRomaji: c.lastNameRomaji,
        firstNameRomaji: c.firstNameRomaji,
        middleNameRomaji: null,
        lastNameKanji: c.lastNameKanji,
        firstNameKanji: c.firstNameKanji,
        lastNameKana: c.lastNameKana,
        firstNameKana: c.firstNameKana,
        nameRomaji: cols.nameRomaji,
        nameKanji: cols.nameKanji,
        nameKana: cols.nameKana,
        nameAtAis: null,
        dateOfBirth: c.dateOfBirth,
        locale,
        student: {
          cohortNumber: c.cohortNumber,
          joinedYear: c.joinedYear,
          leftYear: c.leftYear,
          studentIdNo: c.studentIdNo,
          homeroomTeacher: null,
          classmates: [],
        },
        registeredByParentId: parent.id,
      };
      await tx.verificationRequest.upsert({
        where: { userId: childId },
        create: { userId: childId, answers },
        update: {
          answers,
          status: VerificationStatus.PENDING,
          decidedAt: null,
          reviewerId: null,
          reviewNote: null,
          submittedAt: now,
        },
      });
    } else {
      const child = await tx.user.findFirst({
        where: {
          id: c.existingUserId,
          NOT: { id: parent.id },
          roles: { some: { role: { in: STUDENT_ROLES } } },
        },
        select: {
          id: true,
          roles: {
            where: { role: { in: STUDENT_ROLES } },
            select: { cohortId: true, yearsTo: true },
          },
        },
      });
      if (!child) continue; // no longer registered; the admin sees it's missing
      childId = child.id;
      childName = c.name;
      childCohortId = child.roles[0]?.cohortId ?? null;
      childLeftYear = child.roles[0]?.yearsTo ?? null;
    }

    keptChildIds.add(childId);
    const link = await tx.familyLink.findFirst({
      where: { parentId: parent.id, childId },
      select: { id: true, confirmedAt: true },
    });
    if (link) {
      await tx.familyLink.update({
        where: { id: link.id },
        data: { childName, childCohortId, childLeftYear },
      });
    } else {
      const created = await tx.familyLink.create({
        data: {
          familyId,
          parentId: parent.id,
          childId,
          childName,
          childCohortId,
          childLeftYear,
          initiatedBy: FamilyLinkInitiator.PARENT,
        },
        select: { id: true },
      });
      if (c.mode === "existing") toConfirm.push(created.id);
    }
  }

  // Resubmission: drop children the parent removed (only what the
  // application itself created and nobody has confirmed).
  await tx.familyLink.deleteMany({
    where: {
      parentId: parent.id,
      confirmedAt: null,
      OR: [{ childId: null }, { childId: { notIn: [...keptChildIds] } }],
    },
  });
  await tx.user.deleteMany({
    where: {
      managedById: parent.id,
      state: { in: [AccountState.PENDING_REVIEW, AccountState.NEEDS_INFO] },
      id: { notIn: [...keptChildIds] },
    },
  });
  return toConfirm;
}

/** Ask registered children to confirm the parent's link (best-effort). */
export async function notifyChildConfirmations(
  parent: CurrentUser,
  linkIds: readonly string[],
): Promise<void> {
  for (const linkId of linkIds) {
    try {
      const link = await db.familyLink.findUnique({
        where: { id: linkId },
        select: {
          child: {
            select: {
              ...NOTIFY_USER_SELECT,
              managedBy: { select: NOTIFY_USER_SELECT },
            },
          },
        },
      });
      // A managed child can't sign in: ask the parent who manages it.
      const to = link?.child?.managedBy ?? link?.child;
      if (!to) continue;
      await notify(to, {
        kind: "FAMILY_LINK_REQUEST_AS_CHILD",
        refId: linkId,
        path: "/app/family",
        params: (locale) => ({ name: displayName(parent, locale) }),
      });
    } catch (e) {
      console.error("[parent-onboarding] notification failed", e);
    }
  }
}

/**
 * Older applications (before children had their own): on the admin's
 * decision about the parent, approve (or reject) the child accounts the
 * parent created without an application of their own, and on approval
 * confirm the links to managed children.
 */
export async function settleManagedChildren(
  tx: Tx,
  parentId: string,
  decision: "APPROVE" | "REJECT" | "NEEDS_INFO",
  now: Date = new Date(),
): Promise<void> {
  if (decision === "NEEDS_INFO") return;
  const pending = await tx.user.findMany({
    where: {
      managedById: parentId,
      state: AccountState.PENDING_REVIEW,
      verification: null,
    },
    select: { id: true },
  });
  await tx.user.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: {
      state:
        decision === "APPROVE" ? AccountState.ACTIVE : AccountState.REJECTED,
    },
  });
  if (decision !== "APPROVE") return;
  const links = await tx.familyLink.findMany({
    where: {
      parentId,
      confirmedAt: null,
      child: { managedById: { not: null } },
    },
    select: { id: true, parentId: true, childId: true },
  });
  for (const l of links) await confirmLinkInTx(tx, l, "ADMIN", now);
  for (const p of pending) await syncMemberStatus(p.id, tx, now);
  await syncMemberStatus(parentId, tx, now);
}

export type ParentOutcome = {
  parentId: string;
  requestId: string;
  decision: "APPROVE" | "REJECT" | "NEEDS_INFO";
  note: string | null;
};

/**
 * A parent-only application follows the children: approved once a linked
 * child is approved (ACTIVE) and the link confirmed; rejected when every
 * linked child was rejected. Returns what happened (to notify the parent).
 */
export async function settleParentFromChildren(
  tx: Tx,
  parentId: string,
  now: Date = new Date(),
): Promise<ParentOutcome | null> {
  const parent = await tx.user.findUnique({
    where: { id: parentId },
    select: {
      state: true,
      verification: {
        select: { id: true, status: true, followsChildren: true },
      },
    },
  });
  const request = parent?.verification;
  if (
    parent?.state !== AccountState.PENDING_REVIEW ||
    !request?.followsChildren ||
    request.status !== VerificationStatus.PENDING
  )
    return null;
  const links = await tx.familyLink.findMany({
    where: { parentId, childId: { not: null } },
    select: { confirmedAt: true, child: { select: { state: true } } },
  });
  let decision: "APPROVE" | "REJECT";
  if (
    links.some((l) => l.confirmedAt && l.child?.state === AccountState.ACTIVE)
  )
    decision = "APPROVE";
  else if (
    links.length > 0 &&
    links.every((l) => l.child?.state === AccountState.REJECTED)
  )
    decision = "REJECT";
  else return null;

  const approve = decision === "APPROVE";
  await tx.verificationRequest.update({
    where: { id: request.id },
    data: {
      status: approve
        ? VerificationStatus.APPROVED
        : VerificationStatus.REJECTED,
      decidedAt: now,
    },
  });
  await tx.user.updateMany({
    where: { id: parentId, state: AccountState.PENDING_REVIEW },
    data: { state: approve ? AccountState.ACTIVE : AccountState.REJECTED },
  });
  if (approve) await syncMemberStatus(parentId, tx, now);
  return { parentId, requestId: request.id, decision, note: null };
}

/**
 * After the admin decides a student's application: a parent-registered child
 * takes its parent along. Approving confirms the managing parent's link;
 * a question about the child is sent back to the parent to answer.
 */
export async function settleAfterChildDecision(
  tx: Tx,
  childId: string,
  decision: "APPROVE" | "REJECT" | "NEEDS_INFO",
  note: string | null,
  now: Date = new Date(),
): Promise<ParentOutcome[]> {
  const child = await tx.user.findUnique({
    where: { id: childId },
    select: { managedById: true },
  });
  if (!child) return [];
  const out: ParentOutcome[] = [];

  if (decision === "NEEDS_INFO") {
    if (!child.managedById) return [];
    const req = await tx.verificationRequest.findUnique({
      where: { userId: child.managedById },
      select: { id: true, status: true },
    });
    const moved = await tx.user.updateMany({
      where: { id: child.managedById, state: AccountState.PENDING_REVIEW },
      data: { state: AccountState.NEEDS_INFO },
    });
    if (req?.status === VerificationStatus.PENDING && moved.count) {
      await tx.verificationRequest.update({
        where: { id: req.id },
        data: {
          status: VerificationStatus.NEEDS_INFO,
          decidedAt: now,
          reviewNote: note,
        },
      });
      out.push({
        parentId: child.managedById,
        requestId: req.id,
        decision: "NEEDS_INFO",
        note,
      });
    }
    return out;
  }

  if (decision === "APPROVE") {
    await syncMemberStatus(childId, tx, now);
    if (child.managedById) {
      const links = await tx.familyLink.findMany({
        where: { parentId: child.managedById, childId, confirmedAt: null },
        select: { id: true, parentId: true, childId: true },
      });
      for (const l of links) await confirmLinkInTx(tx, l, "ADMIN", now);
    }
  }
  const parents = await tx.familyLink.findMany({
    where: { childId },
    select: { parentId: true },
    distinct: ["parentId"],
  });
  for (const p of parents) {
    const r = await settleParentFromChildren(tx, p.parentId, now);
    if (r) out.push(r);
  }
  return out;
}

/**
 * Parent-managed child accounts that look like the same person as someone
 * signing up themselves: exact name (romaji or kanji, any order) and the
 * same birth date.
 */
export async function findManagedMatches(
  q: {
    names: (string | null | undefined)[];
    dateOfBirth: string | Date | null;
  },
  excludeUserId: string,
) {
  const dob =
    q.dateOfBirth instanceof Date
      ? q.dateOfBirth
      : q.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(q.dateOfBirth)
        ? new Date(`${q.dateOfBirth}T00:00:00Z`)
        : null;
  const names = q.names.filter((n): n is string => Boolean(n?.trim()));
  if (!dob || Number.isNaN(dob.getTime()) || names.length === 0) return [];
  const candidates = await db.user.findMany({
    where: {
      id: { not: excludeUserId },
      managedById: { not: null },
      dateOfBirth: dob,
      state: { in: [AccountState.ACTIVE, AccountState.PENDING_REVIEW] },
    },
    select: {
      id: true,
      state: true,
      nameRomaji: true,
      nameKanji: true,
      nameAtAis: true,
      managedBy: { select: { id: true, nameRomaji: true, nameKanji: true } },
    },
    take: 20,
  });
  return candidates.filter((u) => names.some((n) => exactNameMatch(n, u)));
}
