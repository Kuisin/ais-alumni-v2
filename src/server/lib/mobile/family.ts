import type {
  CohortChoice,
  FamilyClaimResult,
  FamilyLinkRow,
  FamilyPage,
  FamilySearch,
  InviteCreated,
  InvitePreview,
  InviteRow,
  InvitesPage,
  VouchPage,
} from "@contract/family";
import type { Ok } from "@contract/people";
import { z } from "zod";
import {
  FamilyLinkInitiator,
  InviteKind,
  InviteType,
  VerificationStatus,
  VouchAnswer,
} from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { audit } from "@/server/lib/audit";
import { loadConnections } from "@/server/lib/avatar";
import { cohortShort, parseCohortNumber } from "@/server/lib/cohorts";
import { ensureCohort, loadCohortChoices } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import {
  canClaim,
  canConfirm,
  confirmerFor,
  confirmFamilyLink,
  createFamilyLink,
  type Direction,
  type FamilyLinkView,
  loadFamily,
  removePendingFamilyLink,
  searchFamilyCandidates,
} from "@/server/lib/family";
import { displayName } from "@/server/lib/format";
import { cancelHandover, startHandover } from "@/server/lib/handover";
import {
  findOpenInvite,
  GRADE_INVITE_USES,
  hashInviteToken,
  INVITE_TTL_DAYS,
  MAX_OPEN_INVITES,
  newInviteToken,
} from "@/server/lib/invites";
import { ApiError, type Locale, notFound } from "@/server/lib/mobile/http";
import { labelsFor, memberCard } from "@/server/lib/mobile/people";
import { settleParentFromChildren } from "@/server/lib/parent-onboarding";
import type { CurrentUser } from "@/server/lib/session";
import { syncMemberStatus } from "@/server/lib/status-sync";
import { notifyParentOutcomes } from "@/server/lib/verification/decision-notify";
import { yearsFromAnswers } from "@/server/lib/verification/vouch";

/**
 * 家族, 招待 and 「この方をご存じですか？」 for the native app: the website's
 * /app/family, /app/invite and /app/vouch/[id] pages and their server
 * actions (src/app/actions/{family,invites,vouch,handover}.ts), calling the
 * same lib code with the same checks.
 */

const choices = (cs: { value: string; label: string }[]): CohortChoice[] =>
  cs.map((c) => ({ value: c.value, label: c.label }));

// ---- 家族 (src/app/[locale]/app/(member)/family/page.tsx) ----

const nameOf = (
  u: { nameRomaji: string | null; nameKanji: string | null } | null,
  fallback: string | null,
) => (u ? displayName(u) : (fallback ?? "—"));

function linkRow(me: CurrentUser, l: FamilyLinkView): FamilyLinkRow {
  const who = confirmerFor(l);
  const other = who === "parent" ? l.parent : l.child;
  return {
    id: l.id,
    parentName: nameOf(l.parent, null),
    childName: nameOf(l.child, l.childName),
    status: l.confirmedAt
      ? "confirmed"
      : who === "admin"
        ? "pendingAdmin"
        : "pendingOther",
    pendingName:
      !l.confirmedAt && who !== "admin" ? nameOf(other, l.childName) : null,
    cancellable:
      !l.confirmedAt && (l.parentId === me.id || l.childId === me.id),
  };
}

export async function familyPage(
  me: CurrentUser,
  locale: Locale,
): Promise<FamilyPage> {
  const roles = me.roles.map((r) => r.role);
  const canClaimChild = canClaim(roles, "child");
  const canClaimParent = canClaim(roles, "parent");
  const [{ members, links, managed }, c, l, cohorts] = await Promise.all([
    loadFamily(me),
    loadConnections(me.id),
    labelsFor(locale),
    canClaimChild ? loadCohortChoices(locale) : Promise.resolve([]),
  ]);
  const toConfirm = links.filter((x) => canConfirm(me.id, x));
  const others = links.filter((x) => !canConfirm(me.id, x));
  return {
    canClaimChild,
    canClaimParent,
    toConfirm: toConfirm.flatMap((x) => {
      // I'm the confirmer, so the initiator is the other side.
      const parentAsked = x.initiatedBy === FamilyLinkInitiator.PARENT;
      const initiator = parentAsked ? x.parent : x.child;
      return initiator
        ? [
            {
              linkId: x.id,
              member: memberCard(c, l, initiator),
              key: parentAsked ? ("asChild" as const) : ("asParent" as const),
            },
          ]
        : [];
    }),
    managed: managed.map((m) => {
      const h = m.handoversAsChild[0] ?? null;
      return {
        member: memberCard(c, l, m),
        state:
          m.state === "ACTIVE"
            ? "active"
            : m.state === "PENDING_REVIEW"
              ? "pending"
              : "other",
        handover: h
          ? { email: h.email, expiresAt: h.expiresAt.toISOString() }
          : null,
      };
    }),
    members: members.map((m) => memberCard(c, l, m)),
    links: others.map((x) => linkRow(me, x)),
    cohorts: choices(cohorts),
  };
}

export const SearchQuery = z.object({
  direction: z.enum(["child", "parent"]),
  q: z.string().trim().max(100).default(""),
});

/** The search on 子どもを追加 / 保護者を追加 (FamilySearch). */
export async function familySearch(
  me: CurrentUser,
  direction: Direction,
  q: string,
  locale: Locale,
): Promise<FamilySearch> {
  const roles = me.roles.map((r) => r.role);
  if (!canClaim(roles, direction) || !q) return { items: [] };
  const [found, c, l] = await Promise.all([
    searchFamilyCandidates(me, q, direction),
    loadConnections(me.id),
    labelsFor(locale),
  ]);
  return {
    items: found.map((m) => ({
      member: memberCard(c, l, m, !m.limited),
      limited: m.limited,
    })),
  };
}

const id = z.string().trim().min(1).max(64);

export const ClaimSchema = z.object({
  direction: z.enum(["child", "parent"]),
  otherId: id,
});

/** 「この人は私の子ども（保護者）です」 (claimFamilyAction). */
export async function claimFamily(
  me: CurrentUser,
  body: unknown,
): Promise<FamilyClaimResult> {
  const parsed = ClaimSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "invalid");
  const res = await createFamilyLink(me, parsed.data);
  if (!res.ok) throw new ApiError(400, res.error);
  return { ok: true, message: "sent" };
}

export const ChildNameSchema = z.object({
  childName: z.string().trim().min(1).max(100),
  cohortNumber: z.string().transform((v, ctx) => {
    const n = parseCohortNumber(v);
    if (n == null) {
      ctx.addIssue({ code: "custom", message: "cohort" });
      return z.NEVER;
    }
    return n;
  }),
  leftYear: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}$/.test(v))
    .transform((v) => (v ? Number(v) : null)),
});

/** A child without an account; an admin confirms (claimChildByNameAction). */
export async function claimChildByName(
  me: CurrentUser,
  body: unknown,
): Promise<FamilyClaimResult> {
  const parsed = ChildNameSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "invalid");
  const res = await createFamilyLink(me, {
    direction: "child",
    childName: parsed.data.childName,
    childCohortId: await ensureCohort(parsed.data.cohortNumber),
    childLeftYear: parsed.data.leftYear,
  });
  if (!res.ok) throw new ApiError(400, res.error);
  // Parent status (current / former) follows the child's class.
  await syncMemberStatus(me.id);
  return { ok: true, message: "sentAdmin" };
}

/** 「承認」 (confirmFamilyLinkAction). */
export async function confirmLink(
  me: CurrentUser,
  linkId: string,
): Promise<Ok> {
  if (await confirmFamilyLink(me, linkId)) {
    // A parent waiting on this child may now get access.
    const link = await db.familyLink.findUnique({
      where: { id: linkId },
      select: { parentId: true },
    });
    const outcome = link
      ? await db.$transaction((tx) =>
          settleParentFromChildren(tx, link.parentId),
        )
      : null;
    if (outcome) await notifyParentOutcomes([outcome]);
  }
  return { ok: true };
}

/** 「拒否」 / 「リクエストを取り消す」 (removeFamilyLinkAction). */
export async function removeLink(me: CurrentUser, linkId: string): Promise<Ok> {
  await removePendingFamilyLink(me, linkId);
  return { ok: true };
}

/** 「引き継ぎリンクを送る」 (startHandoverAction). */
export async function startChildHandover(
  me: CurrentUser,
  childId: string,
  email: string,
): Promise<Ok> {
  const r = await startHandover(me, childId, email);
  if (!r.ok) throw new ApiError(400, r.error);
  return { ok: true };
}

/** 「取り消す」 on a pending handover (cancelHandoverAction). */
export async function cancelChildHandover(
  me: CurrentUser,
  childId: string,
): Promise<Ok> {
  await cancelHandover(me, childId);
  return { ok: true };
}

// ---- 招待 (src/app/[locale]/app/(member)/invite/page.tsx) ----

/**
 * The app's own address for invitation links (always production, like the
 * website's publicUrl(): dev shares the database, so links work there).
 * /invite/<token> is the app's route (web, and aisalumni://invite/<token>).
 */
const APP_PUBLIC_URL = "https://ais-alumni.kai-lab.net";

export function appInviteUrl(token: string): string {
  return `${APP_PUBLIC_URL}/invite/${token}`;
}

export async function invitesPage(
  me: CurrentUser,
  locale: Locale,
): Promise<InvitesPage> {
  const [cohorts, invites] = await Promise.all([
    loadCohortChoices(locale),
    db.invite.findMany({
      where: { inviterId: me.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        cohort: { select: { number: true } },
        usedBy: { select: { nameRomaji: true, nameKanji: true } },
        uses: {
          orderBy: { createdAt: "asc" },
          select: { user: { select: { nameRomaji: true, nameKanji: true } } },
        },
      },
    }),
  ]);
  const now = new Date();
  return {
    cohorts: choices(cohorts),
    invites: invites.map((i): InviteRow => {
      const grade = i.kind === InviteKind.GRADE;
      return {
        id: i.id,
        kind: i.kind,
        type: i.type,
        inviteeName: i.inviteeName,
        cohortLabel: i.cohort ? cohortShort(i.cohort, locale) : null,
        createdAt: i.createdAt.toISOString(),
        usedByName: i.usedBy ? displayName(i.usedBy, locale) : null,
        uses: i.uses.length,
        maxUses: i.maxUses,
        usedByNames: i.uses.map((u) => displayName(u.user, locale)),
        status: i.usedAt
          ? grade
            ? "full"
            : "used"
          : i.revokedAt
            ? "revoked"
            : i.expiresAt <= now
              ? "expired"
              : "open",
      };
    }),
  };
}

export const InviteSchema = z.object({
  kind: z.enum(InviteKind).default(InviteKind.INDIVIDUAL),
  type: z.enum(InviteType),
  cohortNumber: z.string().trim().max(4).default(""),
  inviteeName: z
    .string()
    .trim()
    .max(100)
    .default("")
    .transform((v) => v || null),
});

/**
 * Create an invitation link — 個別 or 学年 (createInviteAction, same
 * limits). The token is only returned here; the database keeps its hash.
 */
export async function createInvite(
  me: CurrentUser,
  body: unknown,
): Promise<InviteCreated> {
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "invalid");
  const { kind, type } = parsed.data;
  // A 学年 link isn't for one named person, and teachers have no 学年.
  const inviteeName =
    kind === InviteKind.GRADE ? null : parsed.data.inviteeName;
  if (kind === InviteKind.GRADE && type === InviteType.TEACHER)
    throw new ApiError(400, "invalid");
  // Students and parents are invited for a 学年 (theirs / their child's).
  let cohortId: string | null = null;
  if (type !== InviteType.TEACHER) {
    const n = parseCohortNumber(parsed.data.cohortNumber);
    if (n == null) throw new ApiError(400, "cohort");
    cohortId = await ensureCohort(n);
  }
  const openWhere = {
    inviterId: me.id,
    usedAt: null,
    revokedAt: null,
    expiresAt: { gt: new Date() },
  };
  if (kind === InviteKind.GRADE) {
    const same = await db.invite.count({
      where: { ...openWhere, kind, type, cohortId },
    });
    if (same) throw new ApiError(400, "gradeOpen");
  } else {
    const open = await db.invite.count({
      where: { ...openWhere, kind: InviteKind.INDIVIDUAL },
    });
    if (open >= MAX_OPEN_INVITES) throw new ApiError(400, "tooMany");
  }

  const token = newInviteToken();
  const invite = await db.invite.create({
    data: {
      tokenHash: hashInviteToken(token),
      inviterId: me.id,
      kind,
      maxUses: kind === InviteKind.GRADE ? GRADE_INVITE_USES : 1,
      type,
      cohortId,
      inviteeName,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
    },
    select: { id: true },
  });
  await audit(
    me.id,
    "invite.create",
    { type: "Invite", id: invite.id },
    { kind, type, cohortId },
  );
  return { url: appInviteUrl(token), kind };
}

/** Cancel one of my unused invitations (revokeInviteAction). */
export async function revokeInvite(
  me: CurrentUser,
  inviteId: string,
): Promise<Ok> {
  await db.invite.updateMany({
    where: { id: inviteId, inviterId: me.id, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { ok: true };
}

/**
 * An invitation link being opened (the website's /api/invite/[token] and the
 * sign-in page's banner): who invited, for what. 404 when unusable.
 */
export async function invitePreview(
  token: string,
  locale: Locale,
): Promise<InvitePreview> {
  const invite = await findOpenInvite(token);
  if (!invite) throw notFound();
  return {
    kind: invite.kind,
    type: invite.type,
    // As the website's banner: the romaji name, else kanji.
    inviterName: invite.inviter.nameRomaji ?? invite.inviter.nameKanji ?? "",
    cohortNumber: invite.cohort?.number ?? null,
    cohortLabel: invite.cohort ? cohortShort(invite.cohort, locale) : null,
  };
}

// ---- 「この方をご存じですか？」 (src/app/[locale]/app/(member)/vouch/[id]) ----

const OPEN_STATUSES: readonly string[] = [
  VerificationStatus.PENDING,
  VerificationStatus.NEEDS_INFO,
];

/**
 * Only the asked voucher may view; the applicant is shown with minimal
 * information (name, years at AIS). Missing and "not yours" both 404.
 */
export async function vouchPage(
  me: CurrentUser,
  vouchId: string,
  locale: Locale,
): Promise<VouchPage> {
  const vouch = await db.vouch.findUnique({
    where: { id: vouchId },
    select: {
      voucherId: true,
      answer: true,
      request: {
        select: {
          status: true,
          answers: true,
          user: {
            select: { nameRomaji: true, nameKanji: true, nameAtAis: true },
          },
        },
      },
    },
  });
  if (!vouch || vouch.voucherId !== me.id) throw notFound();
  const t = await getTranslatorFor(locale, "vouch");
  const applicant = vouch.request.user;
  const name = displayName(applicant, locale);
  const other = locale === "ja" ? applicant.nameRomaji : applicant.nameKanji;
  return {
    name,
    otherName: other && other !== name ? other : null,
    nameAtAis: applicant.nameAtAis,
    years: yearsFromAnswers(vouch.request.answers, t("present")) || null,
    answer: vouch.answer,
    closed: !OPEN_STATUSES.includes(vouch.request.status),
  };
}

export const VouchAnswerSchema = z.object({ answer: z.enum(VouchAnswer) });

/** Answer (or change the answer) until the request is decided (answerVouchAction). */
export async function answerVouch(
  me: CurrentUser,
  vouchId: string,
  body: unknown,
): Promise<Ok> {
  const parsed = VouchAnswerSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "validation");
  const vouch = await db.vouch.findUnique({
    where: { id: vouchId },
    select: { voucherId: true, request: { select: { status: true } } },
  });
  if (!vouch || vouch.voucherId !== me.id) throw new ApiError(403, "forbidden");
  if (!OPEN_STATUSES.includes(vouch.request.status))
    throw new ApiError(409, "closed");
  await db.vouch.update({
    where: { id: vouchId },
    data: { answer: parsed.data.answer, answeredAt: new Date() },
  });
  return { ok: true };
}
