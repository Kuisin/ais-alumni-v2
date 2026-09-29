import { randomUUID } from "node:crypto";
import type {
  ChildWaitState,
  EmailCodeSent,
  OnboardingLine,
  OnboardingStatus,
  OtpError,
  VerifyForm,
} from "@contract/onboarding";
import { z } from "zod";
import { Prisma } from "@/server/generated/prisma/client";
import {
  AccountState,
  OtpPurpose,
  RoleKey,
  VerificationStatus,
} from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { issueOtp, normalizeEmail, verifyOtp } from "@/server/lib/auth/otp";
import { ensureCohort, loadCohortChoices } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { consumeInvite, findOpenInvite } from "@/server/lib/invites";
import { lineAddFriendUrl } from "@/server/lib/line-link";
import {
  parentRole,
  studentRoleFields,
  teacherFields,
} from "@/server/lib/member-status";
import { mergeUsers } from "@/server/lib/merge";
import { ApiError } from "@/server/lib/mobile/http";
import { namePartsOf } from "@/server/lib/names";
import { notifyMany } from "@/server/lib/notify";
import { activeAdmins } from "@/server/lib/notify/staff";
import {
  childrenCurrent,
  notifyChildConfirmations,
  type ParentOutcome,
  saveParentChildren,
  settleParentFromChildren,
} from "@/server/lib/parent-onboarding";
import { isCurrentTeacher } from "@/server/lib/school";
import { isSchoolEmail } from "@/server/lib/school-email";
import { schoolEmailTaken } from "@/server/lib/school-email-db";
import { AuthError, actionUser, type CurrentUser } from "@/server/lib/session";
import { setupProgress } from "@/server/lib/setup";
import { loadSetupChecklist } from "@/server/lib/setup-db";
import { ssoReady } from "@/server/lib/sso";
import { assertTransition } from "@/server/lib/state-machine";
import { deletePrivate, putPrivate } from "@/server/lib/storage";
import { notifyParentOutcomes } from "@/server/lib/verification/decision-notify";
import {
  evidenceAcceptable,
  isEvidenceType,
  isOwnEvidenceKey,
  safeFileName,
  sniffMatches,
  statEvidence,
} from "@/server/lib/verification/evidence";
import { computeRosterMatch } from "@/server/lib/verification/match";
import {
  answersToFormState,
  EVIDENCE_MAX_BYTES,
  type EvidenceItem,
  emptyChild,
  emptyFormState,
  issuesToErrors,
  type StoredAnswers,
  type VerificationData,
  type VerifyFormState,
  verificationSchema,
} from "@/server/lib/verification/schema";
import { createVouchesForRequest } from "@/server/lib/verification/vouch";

/**
 * The website's onboarding server actions (src/app/actions/onboarding.ts,
 * verify.ts) and pages (src/app/[locale]/app/onboarding/*) for the app:
 * the same checks, state changes and notifications, returning data or
 * error codes instead of redirecting. Callers resolve the account with
 * `applicant()` / `mobileRoute(…, "user")`.
 */

/** The account in one of these states, else 403 (the website redirects). */
export async function inState(...states: AccountState[]): Promise<CurrentUser> {
  try {
    return await actionUser(...states);
  } catch (e) {
    if (e instanceof AuthError)
      throw new ApiError(
        e.message === "unauthenticated" ? 401 : 403,
        e.message,
      );
    throw e;
  }
}

export const APPLICANT_STATES = [
  AccountState.EMAIL_VERIFIED,
  AccountState.NEEDS_INFO,
] as const;

const otpError = (code: OtpError) => new ApiError(400, code);

// ---------------------------------------------------------------------------
// Email confirmation for LINE-first accounts (§4.2) — actions/onboarding.ts

export async function requestEmailCode(
  user: CurrentUser,
  rawEmail: string,
  resend: boolean,
): Promise<EmailCodeSent> {
  const parsed = z.email().max(254).safeParse(rawEmail.trim());
  if (!parsed.success) throw otpError("invalid_email");
  const email = normalizeEmail(parsed.data);
  const result = await issueOtp({
    email,
    purpose: OtpPurpose.VERIFY_EMAIL,
    locale: user.locale,
    userId: user.id,
  });
  if (!result.ok) {
    if (result.error === "send_failed") throw otpError("send_failed");
    // A code was sent recently: let them enter that one.
    return { notice: "rate_limited", email };
  }
  return { notice: resend ? "resent" : "sent", email };
}

/**
 * Confirm the email of a LINE-first account. If the address already belongs
 * to another member, this LINE account is merged into it (§4.3) — the app's
 * session follows the merge (resolveUserId) — otherwise the address is
 * attached and the account moves to EMAIL_VERIFIED.
 */
export async function confirmEmailCode(
  user: CurrentUser,
  rawEmail: string,
  rawCode: string,
): Promise<void> {
  const email = z.email().max(254).safeParse(rawEmail.trim());
  const code = rawCode.replace(/\s/g, "");
  if (!email.success || !/^\d{6}$/.test(code))
    throw otpError("invalid_code_format");
  const address = normalizeEmail(email.data);
  const result = await verifyOtp({
    email: address,
    purpose: OtpPurpose.VERIFY_EMAIL,
    code,
    userId: user.id,
  });
  if (!result.ok) throw otpError(result.error);

  const now = new Date();
  const existing = await db.user.findUnique({
    where: { primaryEmail: address },
  });
  let targetId = user.id;
  if (existing && existing.id !== user.id) {
    // The app's sessions follow (the website's cookie follows through
    // UserMerge; app sessions would go with the merged-away account).
    await db.mobileSession.updateMany({
      where: { userId: user.id },
      data: { userId: existing.id },
    });
    await mergeUsers(user.id, existing.id);
    targetId = existing.id;
    await audit(
      existing.id,
      "user.merge.line_email",
      { type: "User", id: existing.id },
      { fromUserId: user.id },
    );
  } else {
    assertTransition(user.state, AccountState.EMAIL_VERIFIED);
    try {
      await db.user.update({
        where: { id: user.id },
        data: {
          primaryEmail: address,
          emailVerifiedAt: now,
          state: AccountState.EMAIL_VERIFIED,
        },
      });
    } catch (e) {
      // Someone claimed the address between the lookup and the update.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        throw otpError("generic");
      throw e;
    }
  }

  // LINE-first users already saw LINE's "Add friend" option at sign-up:
  // skip the LINE step if they follow the Official Account.
  const target = await db.user.findUniqueOrThrow({ where: { id: targetId } });
  if (target.lineFollowing && !target.lineOnboardingSeenAt)
    await db.user.update({
      where: { id: targetId },
      data: { lineOnboardingSeenAt: now },
    });
}

// ---------------------------------------------------------------------------
// LINE (§5.2) — pages onboarding/line and the status page's card

export function lineFor(user: CurrentUser): OnboardingLine {
  return {
    ready: ssoReady("line"),
    linked: Boolean(user.lineUserId),
    following: user.lineFollowing,
    displayName: user.lineDisplayName,
    addFriendUrl: lineAddFriendUrl(),
  };
}

/**
 * The LINE step: already linked and following (e.g. just back from
 * linking) → recorded as seen, nothing left to show (null).
 */
export async function lineStep(
  user: CurrentUser,
): Promise<OnboardingLine | null> {
  if (user.lineOnboardingSeenAt) return null;
  if (user.lineUserId && user.lineFollowing) {
    await db.user.update({
      where: { id: user.id },
      data: { lineOnboardingSeenAt: new Date() },
    });
    return null;
  }
  return lineFor(user);
}

/** 「スキップ」/「次へ」 on the LINE step: remember it, go on to the application. */
export async function skipLine(user: CurrentUser): Promise<void> {
  if (!user.lineOnboardingSeenAt)
    await db.user.update({
      where: { id: user.id },
      data: { lineOnboardingSeenAt: new Date() },
    });
}

// ---------------------------------------------------------------------------
// Status (§3.3) — page onboarding/status

export async function statusFor(user: CurrentUser): Promise<OnboardingStatus> {
  const state = user.state as OnboardingStatus["state"];
  const request = await db.verificationRequest.findUnique({
    where: { userId: user.id },
    select: {
      submittedAt: true,
      decidedAt: true,
      reviewNote: true,
      followsChildren: true,
    },
  });
  // Parents alone wait for a child's approval, not for the committee.
  const parentWaiting =
    state === "PENDING_REVIEW" && request?.followsChildren === true;
  const children = parentWaiting
    ? await db.familyLink.findMany({
        where: { parentId: user.id, childId: { not: null } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          childName: true,
          confirmedAt: true,
          child: { select: { state: true, managedById: true } },
        },
      })
    : [];
  const childState = (c: (typeof children)[number]): ChildWaitState =>
    c.child?.state === AccountState.REJECTED
      ? "rejected"
      : c.child?.state === AccountState.ACTIVE
        ? c.confirmedAt || c.child.managedById === user.id
          ? "approved"
          : "needsConfirm"
        : "review";
  const setup =
    state === "PENDING_REVIEW" ? await loadSetupChecklist(user) : null;
  const wantsLine =
    state === "PENDING_REVIEW" && !(user.lineUserId && user.lineFollowing);
  return {
    state,
    parentWaiting,
    children: children.map((c) => ({
      id: c.id,
      name: c.childName ?? "—",
      state: childState(c),
    })),
    submittedAt: request?.submittedAt.toISOString() ?? null,
    decidedAt:
      state === "REJECTED" ? (request?.decidedAt?.toISOString() ?? null) : null,
    reviewNote: state === "REJECTED" ? (request?.reviewNote ?? null) : null,
    deactivatedAt:
      state === "DEACTIVATED"
        ? (user.deactivatedAt?.toISOString() ?? null)
        : null,
    setup: setup
      ? {
          items: setup.map((i) => ({
            key: i.key,
            done: i.done,
            href: i.href,
            optional: Boolean(i.optional),
            recommended: Boolean(i.recommended),
          })),
          ...setupProgress(setup),
        }
      : null,
    line: wantsLine ? lineFor(user) : null,
  };
}

// ---------------------------------------------------------------------------
// The application form (§6) — page onboarding/verify, actions/verify.ts

/** Start from what the inviter said: the type and 学年. */
function prefillFromInvite(
  state: VerifyFormState,
  invite: Awaited<ReturnType<typeof findOpenInvite>>,
): VerifyFormState {
  if (!invite) return state;
  const cohort = invite.cohort ? String(invite.cohort.number) : "";
  if (invite.type === "STUDENT")
    return {
      ...state,
      types: ["STUDENT"],
      student: { ...state.student, cohortNumber: cohort },
    };
  if (invite.type === "PARENT")
    return {
      ...state,
      types: ["PARENT"],
      parent: {
        ...state.parent,
        children: [{ ...emptyChild("new"), cohortNumber: cohort }],
      },
    };
  return { ...state, types: ["TEACHER"] };
}

export async function verifyFormFor(
  user: CurrentUser,
  uiLocale: "ja" | "en",
  inviteToken: string | null,
): Promise<VerifyForm> {
  const request = await db.verificationRequest.findUnique({
    where: { userId: user.id },
    include: { evidence: { orderBy: { createdAt: "asc" } } },
  });
  const evidence: EvidenceItem[] = (request?.evidence ?? []).map((e) => ({
    kind: e.kind,
    key: e.storageKey,
    fileName: e.fileName,
    mimeType: e.mimeType as EvidenceItem["mimeType"],
    size: e.size,
  }));
  const userNames = namePartsOf(user);
  const fromAnswers = request
    ? answersToFormState(request.answers, uiLocale, evidence)
    : null;
  const initial: VerifyFormState = fromAnswers
    ? {
        ...fromAnswers,
        ...(Object.fromEntries(
          Object.entries(userNames).map(([k, v]) => [
            k,
            fromAnswers[k as keyof typeof userNames] || v,
          ]),
        ) as typeof userNames),
      }
    : prefillFromInvite(
        {
          ...emptyFormState(uiLocale),
          ...userNames,
          nameAtAis: user.nameAtAis ?? "",
          dateOfBirth: user.dateOfBirth
            ? user.dateOfBirth.toISOString().slice(0, 10)
            : "",
        },
        await findOpenInvite(inviteToken),
      );
  const teacher = user.roles.find((r) => r.role === RoleKey.TEACHER);
  return {
    userId: user.id,
    needsInfo: user.state === AccountState.NEEDS_INFO,
    reviewNote:
      user.state === AccountState.NEEDS_INFO
        ? (request?.reviewNote ?? null)
        : null,
    initial: initial as unknown as Record<string, unknown>,
    cohorts: await loadCohortChoices(uiLocale),
    verifiedSchoolEmail:
      teacher?.schoolEmailVerified && teacher.schoolEmail
        ? teacher.schoolEmail
        : null,
  };
}

const submitError = (
  error: "validation" | "forbidden" | "generic" | "evidence",
  errors?: Record<string, string>,
) => new ApiError(400, error, errors ? { errors } : {});

/** Submit (§6.1–§6.4): the website's submitVerificationAction. */
export async function submitVerification(
  user: CurrentUser,
  raw: unknown,
  uiLocale: "ja" | "en" | null,
  inviteToken: string | null,
): Promise<void> {
  const parsed = verificationSchema({
    // Kanji/kana is required when the applicant uses the Japanese UI (§6.1).
    requireKanji: (uiLocale ?? user.locale) === "ja",
  }).safeParse(raw);
  if (!parsed.success)
    throw submitError("validation", issuesToErrors(parsed.error.issues));
  const data = parsed.data;

  const existing = await db.verificationRequest.findUnique({
    where: { userId: user.id },
    select: { id: true, evidence: { select: { id: true, storageKey: true } } },
  });

  // Evidence: keys must be under this user's prefix and actually stored.
  const keptKeys = new Set(existing?.evidence.map((e) => e.storageKey) ?? []);
  const newEvidence: EvidenceItem[] = [];
  const keptKinds = new Map<string, EvidenceItem["kind"]>();
  const seen = new Set<string>();
  for (const item of data.evidence) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    if (!isOwnEvidenceKey(user.id, item.key))
      throw submitError("evidence", { evidence: "evidenceInvalid" });
    if (keptKeys.has(item.key)) {
      keptKinds.set(item.key, item.kind);
      continue;
    }
    const stat = await statEvidence(item.key);
    if (!stat || !evidenceAcceptable(stat))
      throw submitError("evidence", { evidence: "evidenceInvalid" });
    newEvidence.push({
      ...item,
      size: stat.size || item.size,
      mimeType: isEvidenceType(stat.contentType)
        ? stat.contentType
        : item.mimeType,
    });
  }
  const removedEvidence = (existing?.evidence ?? []).filter(
    (e) => !seen.has(e.storageKey),
  );

  const roster = await computeRosterMatch(data);
  const schoolEmailVerified = await isSchoolEmailVerified(user, data);
  const schoolEmail = data.teacher?.schoolEmail ?? null;
  if (schoolEmail && (await schoolEmailTaken(schoolEmail, user.id)))
    throw submitError("validation", {
      "teacher.schoolEmail": "schoolEmailTaken",
    });
  if (
    data.teacher &&
    isCurrentTeacher(data.teacher.leftYear) &&
    !schoolEmailVerified
  )
    throw submitError("validation", {
      "teacher.schoolEmail": "schoolEmailUnverified",
    });

  // Parents alone aren't reviewed: they follow their children's approval.
  const followsChildren = data.types.every((x) => x === "PARENT");
  let requestId: string;
  let childLinksToConfirm: string[] = [];
  let settled: ParentOutcome | null = null;
  try {
    assertTransition(user.state, AccountState.PENDING_REVIEW);
    requestId = await db.$transaction(async (tx) => {
      // Guard against a concurrent state change (double submit, admin action).
      const moved = await tx.user.updateMany({
        where: { id: user.id, state: user.state },
        data: {
          lastNameRomaji: data.lastNameRomaji,
          firstNameRomaji: data.firstNameRomaji,
          middleNameRomaji: data.middleNameRomaji,
          lastNameKanji: data.lastNameKanji,
          firstNameKanji: data.firstNameKanji,
          lastNameKana: data.lastNameKana,
          firstNameKana: data.firstNameKana,
          nameKana: data.nameKana,
          nameRomaji: data.nameRomaji,
          nameKanji: data.nameKanji,
          nameAtAis: data.nameAtAis,
          dateOfBirth: new Date(`${data.dateOfBirth}T00:00:00Z`),
          gender: data.gender,
          locale: data.locale,
          state: AccountState.PENDING_REVIEW,
        },
      });
      if (moved.count !== 1) throw new Error("state changed");

      await saveRoles(tx, user, data, schoolEmailVerified);

      const answers: StoredAnswers = { version: 2, ...omitEvidence(data) };
      const request = await tx.verificationRequest.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          answers: answers as Prisma.InputJsonValue,
          rosterScore: roster?.score ?? null,
          rosterRowId: roster?.rowId ?? null,
          followsChildren,
        },
        // Resubmission after NEEDS_INFO keeps the original submittedAt so the
        // queue stays first-come-first-served; reviewNote is kept for context.
        update: {
          answers: answers as Prisma.InputJsonValue,
          rosterScore: roster?.score ?? null,
          rosterRowId: roster?.rowId ?? null,
          status: VerificationStatus.PENDING,
          decidedAt: null,
          reviewerId: null,
          followsChildren,
        },
        select: { id: true },
      });

      if (removedEvidence.length)
        await tx.verificationEvidence.deleteMany({
          where: { id: { in: removedEvidence.map((e) => e.id) } },
        });
      // Files kept from an earlier submission may have changed type.
      for (const [storageKey, kind] of keptKinds)
        await tx.verificationEvidence.updateMany({
          where: { requestId: request.id, storageKey },
          data: { kind },
        });
      if (newEvidence.length)
        await tx.verificationEvidence.createMany({
          data: newEvidence.map((e) => ({
            kind: e.kind,
            requestId: request.id,
            storageKey: e.key,
            fileName: e.fileName,
            mimeType: e.mimeType,
            size: e.size,
          })),
        });

      childLinksToConfirm = data.parent
        ? await saveParentChildren(tx, user, data.parent.children, data.locale)
        : [];
      // A child approved earlier may already let the parent in.
      settled = await settleParentFromChildren(tx, user.id);
      return request.id;
    });
  } catch (e) {
    console.error("[verify] submit failed", e);
    throw submitError("generic");
  }

  for (const e of removedEvidence)
    await deletePrivate(e.storageKey).catch((err) =>
      console.error(`[verify] delete ${e.storageKey} failed`, err),
    );
  // The invitation (kept by the app instead of a cookie) is used once.
  await consumeInvite(inviteToken ?? undefined, user.id).catch((e) =>
    console.error("[verify] invite failed", e),
  );
  await notifyChildConfirmations(user, childLinksToConfirm);
  if (settled) await notifyParentOutcomes([settled]);
  // Vouch requests (§6.4.2) are best-effort.
  await createVouchesForRequest(requestId).catch((e) =>
    console.error("[verify] vouches failed", e),
  );
  // Admins hear about every application that waits for review (new or
  // resubmitted), right away; parent-only ones follow their children.
  if (!followsChildren)
    await activeAdmins()
      .then((admins) =>
        notifyMany(admins, {
          kind: "VERIFICATION_SUBMITTED_ADMIN",
          refId: requestId,
          path: `/app/admin/verification/${requestId}`,
          params: { name: displayName(data) },
        }),
      )
      .catch((e) => console.error("[verify] admin notify failed", e));
}

function omitEvidence(
  data: VerificationData,
): Omit<VerificationData, "evidence"> {
  const { evidence: _evidence, ...rest } = data;
  return rest;
}

async function isSchoolEmailVerified(
  user: CurrentUser,
  data: VerificationData,
): Promise<boolean> {
  const email = data.teacher?.schoolEmail;
  if (!email || !isSchoolEmail(email)) return false;
  const role = user.roles.find((r) => r.role === RoleKey.TEACHER);
  if (role?.schoolEmailVerified && role.schoolEmail === email) return true;
  // A consumed SCHOOL_EMAIL code for this user + address proves ownership.
  const otp = await db.otpCode.findFirst({
    where: {
      email: normalizeEmail(email),
      purpose: OtpPurpose.SCHOOL_EMAIL,
      userId: user.id,
      consumedAt: { not: null },
    },
    select: { id: true },
  });
  return otp !== null;
}

/**
 * Roles from the chosen types. Current vs former (and grade, graduation,
 * last division) are derived from the 学年 and years, never picked by hand.
 */
async function saveRoles(
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  data: VerificationData,
  schoolEmailVerified: boolean,
): Promise<void> {
  const now = new Date();
  const keep: RoleKey[] = [];
  const cohortEnd = async (n: number) => {
    const id = await ensureCohort(n, tx);
    const row = await tx.cohort.findUniqueOrThrow({
      where: { id },
      select: { elementaryEndYear: true },
    });
    return { id, end: row.elementaryEndYear };
  };
  const upsert = async (
    role: RoleKey,
    fields: Omit<Prisma.UserRoleUncheckedCreateInput, "userId" | "role">,
  ) => {
    keep.push(role);
    await tx.userRole.upsert({
      where: { userId_role: { userId: user.id, role } },
      create: { userId: user.id, role, ...fields },
      update: fields,
    });
  };

  if (data.student) {
    const st = data.student;
    const c = await cohortEnd(st.cohortNumber);
    const { role, ...fields } = studentRoleFields(
      c.end,
      st.joinedYear,
      st.leftYear,
      now,
    );
    await upsert(role, {
      ...fields,
      cohortId: c.id,
      studentIdNo: st.studentIdNo,
    });
  }
  if (data.teacher) {
    const t = data.teacher;
    await upsert(RoleKey.TEACHER, {
      ...teacherFields(t.joinedYear, t.leftYear, now),
      subjects: t.subjects,
      schoolEmail: t.schoolEmail,
      schoolEmailVerified,
    });
  }
  if (data.parent)
    await upsert(
      parentRole(await childrenCurrent(tx, data.parent.children, now)),
      {},
    );
  // Applicants are never ACTIVE here, so dropping other roles is safe.
  await tx.userRole.deleteMany({
    where: { userId: user.id, role: { notIn: keep } },
  });
}

// ---------------------------------------------------------------------------
// Evidence files (§6.3): JPG/PNG/PDF, ≤10 MB, stored privately.

/** Store one uploaded file (the website's uploadEvidenceAction). */
export async function uploadEvidence(
  user: CurrentUser,
  file: File,
  kind: unknown,
): Promise<EvidenceItem> {
  if (!isEvidenceType(file.type)) throw new ApiError(400, "type");
  if (file.size <= 0 || file.size > EVIDENCE_MAX_BYTES)
    throw new ApiError(400, "size");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffMatches(buf.subarray(0, 8), file.type))
    throw new ApiError(400, "type");
  const name = file.name || "file";
  const key = await putPrivate(
    `evidence/${user.id}/${randomUUID()}-${safeFileName(name)}`,
    buf,
    file.type,
  );
  return {
    kind: kind === "DIPLOMA" ? "DIPLOMA" : "OTHER",
    key,
    fileName: name.slice(0, 200),
    mimeType: file.type,
    size: file.size,
  };
}

/** Remove an uploaded-but-not-yet-submitted file. */
export async function discardEvidence(
  user: CurrentUser,
  key: string,
): Promise<void> {
  if (!isOwnEvidenceKey(user.id, key)) return;
  // Files already attached to the request are removed on resubmission.
  const attached = await db.verificationEvidence.findFirst({
    where: { storageKey: key },
    select: { id: true },
  });
  if (attached) return;
  await deletePrivate(key).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Teacher school email (§6.2): @aisnagoya.net, confirmed with a code.

const schoolEmailError = (code: string) => new ApiError(400, code);

export async function sendSchoolEmailCode(
  user: CurrentUser,
  raw: string,
): Promise<void> {
  const parsed = z.email().max(254).safeParse(raw.trim());
  if (!parsed.success) throw schoolEmailError("invalidEmail");
  if (!isSchoolEmail(parsed.data)) throw schoolEmailError("wrongDomain");
  if (await schoolEmailTaken(parsed.data, user.id))
    throw schoolEmailError("taken");
  const res = await issueOtp({
    email: parsed.data,
    purpose: OtpPurpose.SCHOOL_EMAIL,
    locale: user.locale,
    userId: user.id,
  });
  if (!res.ok)
    throw schoolEmailError(
      res.error === "send_failed" ? "sendFailed" : "rateLimited",
    );
}

export async function confirmSchoolEmailCode(
  user: CurrentUser,
  raw: string,
  code: string,
): Promise<void> {
  const e = z.email().max(254).safeParse(raw.trim());
  if (!e.success) throw schoolEmailError("invalidEmail");
  if (!/^\d{6}$/.test(code.trim())) throw schoolEmailError("invalid");
  // Success is recorded by the consumed OtpCode row; submitting reads it.
  const res = await verifyOtp({
    email: e.data,
    purpose: OtpPurpose.SCHOOL_EMAIL,
    code: code.trim(),
    userId: user.id,
  });
  if (!res.ok)
    throw schoolEmailError(
      res.error === "too_many_attempts" ? "tooManyAttempts" : res.error,
    );
}
