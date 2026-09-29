import { createHash, randomBytes } from "node:crypto";
import { InviteKind, InviteType } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { publicUrl } from "@/server/lib/urls";

/**
 * Member invitations. A member says who they're inviting (type and 学年);
 * the invitee signs up through the link, and admins see the inviter's word
 * next to the application, which speeds up approval. Two kinds:
 *  - 個別招待 (INDIVIDUAL): one person, one use — a strong recommendation.
 *    Members may have many open.
 *  - 学年招待 (GRADE): one link for a 学年 (e.g. for a class LINE group),
 *    usable by up to GRADE_INVITE_USES people; one open link per member,
 *    学年 and type at a time.
 * Only a hash of the token is stored; links expire after 30 days. `usedAt`
 * marks a link that can't be used any more (used / full).
 */

export const INVITE_TTL_DAYS = 30;
/** open 個別招待 per member (anti-spam) */
export const MAX_OPEN_INVITES = 100;
/** people per 学年招待 link */
export const GRADE_INVITE_USES = 10;
/** Cookie holding the token between opening the link and applying. */
export const INVITE_COOKIE = "ais_invite";

export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The link to share (opens the app with the invitation). */
export function inviteUrl(token: string, locale: "ja" | "en"): string {
  return publicUrl(`/api/invite/${token}?l=${locale}`);
}

/** A usable invitation for this token (unused, not revoked or expired). */
export async function findOpenInvite(token: string | undefined | null) {
  if (!token || token.length > 100) return null;
  return db.invite.findFirst({
    where: {
      tokenHash: hashInviteToken(token),
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      kind: true,
      type: true,
      inviterId: true,
      inviteeName: true,
      cohort: { select: { number: true } },
      inviter: { select: { nameRomaji: true, nameKanji: true } },
    },
  });
}

/**
 * Record that this applicant signed up through the invitation (no-op if
 * it's used up, or they already used one). 個別: marks it used. 学年:
 * adds a use, and marks it full at GRADE_INVITE_USES.
 */
export async function consumeInvite(
  token: string | undefined | null,
  userId: string,
): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const now = new Date();
  const open = {
    tokenHash: hashInviteToken(token),
    usedAt: null,
    revokedAt: null,
    expiresAt: { gt: now },
    inviterId: { not: userId },
  };
  try {
    const invite = await db.invite.findFirst({
      where: open,
      select: { id: true, kind: true, maxUses: true },
    });
    if (!invite) return false;
    if (invite.kind === InviteKind.INDIVIDUAL) {
      const already = await db.inviteUse.count({ where: { userId } });
      if (already) return false;
      const res = await db.invite.updateMany({
        where: { ...open, id: invite.id },
        data: { usedAt: now, usedById: userId },
      });
      return res.count > 0;
    }
    return await db.$transaction(async (tx) => {
      // One invitation per applicant (individual ones use usedById).
      const other = await tx.invite.count({ where: { usedById: userId } });
      if (other) return false;
      const uses = await tx.inviteUse.count({ where: { inviteId: invite.id } });
      if (uses >= invite.maxUses) return false;
      await tx.inviteUse.create({ data: { inviteId: invite.id, userId } });
      if (uses + 1 >= invite.maxUses)
        await tx.invite.update({
          where: { id: invite.id },
          data: { usedAt: now },
        });
      return true;
    });
  } catch {
    // usedById / InviteUse.userId are unique: already used an invitation.
    return false;
  }
}

/** The invitation a member signed up through (either kind), for admins. */
export const INVITE_OF_USER_SELECT = {
  inviteUsed: {
    select: {
      kind: true,
      type: true,
      inviteeName: true,
      createdAt: true,
      maxUses: true,
      cohort: { select: { number: true } },
      inviter: { select: { id: true, nameRomaji: true, nameKanji: true } },
      _count: { select: { uses: true } },
    },
  },
  inviteUse: {
    select: {
      invite: {
        select: {
          kind: true,
          type: true,
          inviteeName: true,
          createdAt: true,
          maxUses: true,
          cohort: { select: { number: true } },
          inviter: {
            select: { id: true, nameRomaji: true, nameKanji: true },
          },
          _count: { select: { uses: true } },
        },
      },
    },
  },
} as const;

export function inviteOfUser<I>(u: {
  inviteUsed: I | null;
  inviteUse: { invite: I } | null;
}): I | null {
  return u.inviteUsed ?? u.inviteUse?.invite ?? null;
}

export type InviteMatch = "match" | "mismatch" | "unknown";

/**
 * Does the application agree with what the inviter said? Students: same
 * 学年; parents: a child in that 学年; teachers: applied as a teacher.
 */
export function inviteMatches(
  invite: { type: InviteType; cohortNumber: number | null },
  answers: unknown,
): InviteMatch {
  const a = (answers ?? {}) as {
    types?: string[];
    student?: { cohortNumber?: number };
    parent?: { children?: { cohortNumber?: number }[] };
  };
  const types = Array.isArray(a.types) ? a.types : [];
  if (invite.type === InviteType.TEACHER)
    return types.includes("TEACHER") ? "match" : "mismatch";
  if (!types.includes(invite.type)) return "mismatch";
  if (invite.cohortNumber === null) return "unknown";
  if (invite.type === InviteType.STUDENT)
    return a.student?.cohortNumber === invite.cohortNumber
      ? "match"
      : "mismatch";
  const kids = a.parent?.children ?? [];
  // Registered children carry no 学年 in the answers.
  if (!kids.some((c) => typeof c.cohortNumber === "number")) return "unknown";
  return kids.some((c) => c.cohortNumber === invite.cohortNumber)
    ? "match"
    : "mismatch";
}
