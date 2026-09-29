import { db } from "@/server/lib/db";
import { deletePrivate } from "@/server/lib/storage";

/**
 * Account-level operations for the member's own account (§4.3, §15 APPI):
 * sign-in method rules, data export and permanent deletion.
 */

// ---------------------------------------------------------------------------
// Sign-in methods (§4.3) — pure rules, unit-tested in account.test.ts
// ---------------------------------------------------------------------------

export const OAUTH_PROVIDERS = ["google", "line"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
export type SignInMethod = "email" | OAuthProvider;

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return (
    typeof value === "string" &&
    (OAUTH_PROVIDERS as readonly string[]).includes(value)
  );
}

/**
 * Methods the user can currently sign in with. The email code is available
 * whenever the primary email is verified; OAuth methods come from Account rows.
 */
export function signInMethods(input: {
  primaryEmail: string | null;
  emailVerifiedAt: Date | null;
  providers: readonly string[];
}): SignInMethod[] {
  const out: SignInMethod[] = [];
  if (input.primaryEmail && input.emailVerifiedAt) out.push("email");
  for (const p of OAUTH_PROVIDERS) {
    if (input.providers.includes(p)) out.push(p);
  }
  return out;
}

/**
 * A method may be removed only if it is linked, is not the email code (the
 * email code is tied to the primary email and cannot be removed), and at
 * least one other method remains afterwards.
 */
export function canRemoveSignInMethod(
  methods: readonly SignInMethod[],
  method: SignInMethod,
): boolean {
  if (method === "email") return false;
  if (!methods.includes(method)) return false;
  return methods.some((m) => m !== method);
}

/**
 * Admin rights may be revoked only while another admin remains, so the
 * association can never lock itself out (§3.2).
 */
export function canRevokeAdmin(input: {
  targetIsAdmin: boolean;
  adminCount: number;
}): boolean {
  return input.targetIsAdmin && input.adminCount > 1;
}

/** Calendar year in JST (the stage prompt runs on April 1 JST, §7). */
export function jstYear(date: Date): number {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).getUTCFullYear();
}

// ---------------------------------------------------------------------------
// Stored files
// ---------------------------------------------------------------------------

/**
 * avatarUrl holds either a private storage key (uploaded avatar) or an
 * external http(s) URL (e.g. Google profile picture). Only keys are ours to
 * delete. Assumption: stored keys are relative paths, never starting with "/".
 */
export function isStorageKey(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  return (
    !/^https?:\/\//i.test(value) &&
    !value.startsWith("/") &&
    !value.startsWith("data:")
  );
}

async function userFileKeys(userId: string): Promise<string[]> {
  const [user, evidence] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } }),
    db.verificationEvidence.findMany({
      where: { request: { userId } },
      select: { storageKey: true },
    }),
  ]);
  const keys = evidence.map((e) => e.storageKey);
  if (isStorageKey(user?.avatarUrl)) keys.push(user.avatarUrl);
  return keys;
}

// ---------------------------------------------------------------------------
// Deletion (APPI)
// ---------------------------------------------------------------------------

export type DeleteAccountResult =
  | { ok: true; filesDeleted: number; filesFailed: number }
  | { ok: false; error: "not_found" | "sole_admin_content" };

/**
 * Permanently delete a user: their stored files first, then the User row
 * (all dependent rows cascade per the schema).
 *
 * Events/news have a required, non-cascading `createdById`. Assumption: when
 * the deleted user authored content, authorship is transferred to another
 * admin (the content belongs to the association, not the author). If no other
 * admin exists the deletion is refused.
 */
export async function deleteUserAccount(
  userId: string,
): Promise<DeleteAccountResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "not_found" };

  const [events, news] = await Promise.all([
    db.event.count({ where: { createdById: userId } }),
    db.newsPost.count({ where: { createdById: userId } }),
  ]);
  let heir: string | null = null;
  if (events + news > 0) {
    const other = await db.user.findFirst({
      where: { isAdmin: true, state: "ACTIVE", id: { not: userId } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!other) return { ok: false, error: "sole_admin_content" };
    heir = other.id;
  }

  // Files first: once the row is gone we lose the keys. A failed file delete
  // is logged but does not block the account deletion.
  let filesDeleted = 0;
  let filesFailed = 0;
  for (const key of await userFileKeys(userId)) {
    try {
      await deletePrivate(key);
      filesDeleted++;
    } catch (e) {
      filesFailed++;
      console.error(`[account] failed to delete file for ${userId}`, e);
    }
  }

  await db.$transaction(async (tx) => {
    if (heir) {
      await tx.event.updateMany({
        where: { createdById: userId },
        data: { createdById: heir },
      });
      await tx.newsPost.updateMany({
        where: { createdById: userId },
        data: { createdById: heir },
      });
    }
    // Plain-string references (no FK) that would otherwise keep the id around.
    await tx.rosterEntry.updateMany({
      where: { claimedByUserId: userId },
      data: { claimedByUserId: null },
    });
    await tx.otpCode.deleteMany({ where: { userId } });
    await tx.userMerge.deleteMany({ where: { toUserId: userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  return { ok: true, filesDeleted, filesFailed };
}

// ---------------------------------------------------------------------------
// Export (APPI) — the user's own data only
// ---------------------------------------------------------------------------

const OTHER_USER = { id: true, nameRomaji: true, nameKanji: true } as const;

/**
 * Everything we hold about the user, as plain JSON. Other people appear only
 * by id + name (their public tier); their private fields are never included.
 * Blocks *against* the user are omitted (that would reveal who blocked them).
 */
export async function buildUserExport(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      accounts: { select: { provider: true, createdAt: true } },
      verification: {
        include: {
          evidence: {
            select: {
              fileName: true,
              mimeType: true,
              size: true,
              createdAt: true,
              deleteAfter: true,
            },
          },
        },
      },
      followsOut: { include: { followee: { select: OTHER_USER } } },
      followsIn: { include: { follower: { select: OTHER_USER } } },
      blocksOut: { include: { blocked: { select: OTHER_USER } } },
      parentLinks: { include: { child: { select: OTHER_USER } } },
      childLinks: { include: { parent: { select: OTHER_USER } } },
      rsvps: {
        include: {
          event: {
            select: { id: true, titleJa: true, titleEn: true, startsAt: true },
          },
        },
      },
      vouchesGiven: {
        select: { answer: true, askedAt: true, answeredAt: true },
      },
      notifications: { orderBy: { sentAt: "desc" } },
      education: true,
      work: true,
    },
  });
  if (!user) return null;

  const v = user.verification;
  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      primaryEmail: user.primaryEmail,
      emailVerifiedAt: user.emailVerifiedAt,
      state: user.state,
      isAdmin: user.isAdmin,
      locale: user.locale,
      nameRomaji: user.nameRomaji,
      nameKanji: user.nameKanji,
      nameAtAis: user.nameAtAis,
      dateOfBirth: user.dateOfBirth,
      avatarUrl: isStorageKey(user.avatarUrl)
        ? "(uploaded image)"
        : user.avatarUrl,
      bio: user.bio,
      phone: user.phone,
      socialLinks: user.socialLinks,
      line: {
        linked: Boolean(user.lineUserId),
        displayName: user.lineDisplayName,
        following: user.lineFollowing,
      },
      notifyVia: user.notifyVia,
      autoAcceptSameYear: user.autoAcceptSameYear,
      deactivatedAt: user.deactivatedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    signInMethods: user.accounts,
    roles: user.roles.map(({ id: _id, userId: _u, ...r }) => r),
    verification: v
      ? {
          status: v.status,
          answers: v.answers,
          submittedAt: v.submittedAt,
          decidedAt: v.decidedAt,
          reviewNote: v.reviewNote,
          evidence: v.evidence,
        }
      : null,
    following: user.followsOut.map((f) => ({
      user: f.followee,
      status: f.status,
      createdAt: f.createdAt,
    })),
    followers: user.followsIn.map((f) => ({
      user: f.follower,
      status: f.status,
      createdAt: f.createdAt,
    })),
    blocked: user.blocksOut.map((b) => ({
      user: b.blocked,
      createdAt: b.createdAt,
    })),
    familyLinks: [
      ...user.parentLinks.map((l) => ({
        as: "parent" as const,
        child: l.child ?? { name: l.childName },
        confirmedAt: l.confirmedAt,
        createdAt: l.createdAt,
      })),
      ...user.childLinks.map((l) => ({
        as: "child" as const,
        parent: l.parent,
        confirmedAt: l.confirmedAt,
        createdAt: l.createdAt,
      })),
    ],
    rsvps: user.rsvps.map((r) => ({
      event: r.event,
      answer: r.answer,
      guests: r.guests,
      updatedAt: r.updatedAt,
    })),
    vouchesGiven: user.vouchesGiven,
    notifications: user.notifications.map(({ userId: _u, ...n }) => n),
    education: user.education.map(({ userId: _u, ...e }) => e),
    work: user.work.map(({ userId: _u, ...e }) => e),
  };
}
