import { db } from "@/server/lib/db";

/**
 * Merge `fromId` into `toId` (§4.3 LINE→existing email, §3.2 admin merge).
 * Moves sign-in methods, LINE link, roles the target lacks, social graph,
 * RSVPs and family links, then deletes `fromId` and records a UserMerge row so
 * live sessions for `fromId` resolve to `toId`.
 */
/** Thrown when a merge would keep a parent-managed account over one the member signs in to. */
export class MergeKeepsManagedError extends Error {
  constructor() {
    super(
      "Keep the account the member signs in to, not the parent-managed one",
    );
  }
}

export async function mergeUsers(
  fromId: string,
  toId: string,
  /** force: an admin chose to keep a parent-managed account anyway */
  opts: { force?: boolean } = {},
): Promise<void> {
  if (fromId === toId) throw new Error("Cannot merge a user into itself");
  await db.$transaction(async (tx) => {
    const [from, to] = await Promise.all([
      tx.user.findUniqueOrThrow({
        where: { id: fromId },
        include: { roles: true, _count: { select: { accounts: true } } },
      }),
      tx.user.findUniqueOrThrow({
        where: { id: toId },
        include: { roles: true },
      }),
    ]);
    // A parent-managed account (no sign-in) must not absorb the member's own
    // account; keep theirs instead.
    const fromSignsIn = Boolean(
      from.primaryEmail || from.lineUserId || from._count.accounts > 0,
    );
    if (to.managedById && fromSignsIn) {
      if (!opts.force) throw new MergeKeepsManagedError();
      // Kept anyway: the member signs in to it now, so the parent no
      // longer manages it (like a completed handover).
      await tx.user.update({
        where: { id: toId },
        data: { managedById: null },
      });
    }

    await tx.account.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });

    // Roles: keep the target's record when both have the same role.
    const toRoles = new Set(to.roles.map((r) => r.role));
    for (const r of from.roles) {
      if (!toRoles.has(r.role)) {
        await tx.userRole.update({
          where: { id: r.id },
          data: { userId: toId },
        });
      }
    }

    // Follows / blocks: move rows that don't collide or become self-references.
    const follows = await tx.follow.findMany({
      where: { OR: [{ followerId: fromId }, { followeeId: fromId }] },
    });
    for (const f of follows) {
      const followerId = f.followerId === fromId ? toId : f.followerId;
      const followeeId = f.followeeId === fromId ? toId : f.followeeId;
      const clash =
        followerId === followeeId ||
        (await tx.follow.findUnique({
          where: { followerId_followeeId: { followerId, followeeId } },
        }));
      if (!clash)
        await tx.follow.update({
          where: { id: f.id },
          data: { followerId, followeeId },
        });
    }
    const blocks = await tx.block.findMany({
      where: { OR: [{ blockerId: fromId }, { blockedId: fromId }] },
    });
    for (const b of blocks) {
      const blockerId = b.blockerId === fromId ? toId : b.blockerId;
      const blockedId = b.blockedId === fromId ? toId : b.blockedId;
      const clash =
        blockerId === blockedId ||
        (await tx.block.findUnique({
          where: { blockerId_blockedId: { blockerId, blockedId } },
        }));
      if (!clash)
        await tx.block.update({
          where: { id: b.id },
          data: { blockerId, blockedId },
        });
    }

    const rsvps = await tx.rsvp.findMany({ where: { userId: fromId } });
    for (const r of rsvps) {
      const clash = await tx.rsvp.findUnique({
        where: { eventId_userId: { eventId: r.eventId, userId: toId } },
      });
      if (!clash)
        await tx.rsvp.update({ where: { id: r.id }, data: { userId: toId } });
    }

    await tx.familyLink.updateMany({
      where: { parentId: fromId },
      data: { parentId: toId },
    });
    await tx.familyLink.updateMany({
      where: { childId: fromId },
      data: { childId: toId },
    });
    await tx.vouch.updateMany({
      where: { voucherId: fromId },
      data: { voucherId: toId },
    });
    await tx.notificationLog.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    // Read receipts: drop the source's where the target got the same link.
    const toLinks = await tx.notificationReceipt.findMany({
      where: { userId: toId },
      select: { linkId: true },
    });
    await tx.notificationReceipt.deleteMany({
      where: { userId: fromId, linkId: { in: toLinks.map((r) => r.linkId) } },
    });
    await tx.notificationReceipt.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.supportRequest.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.genderRequest.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    // A 学年招待 use moves over unless the target already used an invitation.
    const toUse = await tx.inviteUse.count({ where: { userId: toId } });
    if (toUse) await tx.inviteUse.deleteMany({ where: { userId: fromId } });
    else
      await tx.inviteUse.updateMany({
        where: { userId: fromId },
        data: { userId: toId },
      });
    // 学歴・職歴 move with the account.
    await tx.educationEntry.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.workEntry.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });

    // Profile fields: fill gaps on the target from the source.
    await tx.user.update({ where: { id: fromId }, data: { lineUserId: null } });
    await tx.user.update({
      where: { id: toId },
      data: {
        lineUserId: to.lineUserId ?? from.lineUserId,
        lineDisplayName: to.lineDisplayName ?? from.lineDisplayName,
        lineFollowing: to.lineUserId ? to.lineFollowing : from.lineFollowing,
        // Take the whole romaji / kanji name from one side so parts stay consistent.
        ...(to.nameRomaji
          ? {}
          : {
              lastNameRomaji: from.lastNameRomaji,
              firstNameRomaji: from.firstNameRomaji,
              middleNameRomaji: from.middleNameRomaji,
              nameRomaji: from.nameRomaji,
            }),
        ...(to.nameKanji
          ? {}
          : {
              lastNameKanji: from.lastNameKanji,
              firstNameKanji: from.firstNameKanji,
              nameKanji: from.nameKanji,
              lastNameKana: from.lastNameKana,
              firstNameKana: from.firstNameKana,
              nameKana: from.nameKana,
            }),
        ...(to.nameKanji && !to.nameKana && from.nameKana
          ? {
              lastNameKana: from.lastNameKana,
              firstNameKana: from.firstNameKana,
              nameKana: from.nameKana,
            }
          : {}),
        nameAtAis: to.nameAtAis ?? from.nameAtAis,
        dateOfBirth: to.dateOfBirth ?? from.dateOfBirth,
        avatarUrl: to.avatarUrl ?? from.avatarUrl,
        gender: to.gender ?? from.gender,
        phone: to.phone ?? from.phone,
        familyId: to.familyId ?? from.familyId,
      },
    });

    await tx.userMerge.updateMany({
      where: { toUserId: fromId },
      data: { toUserId: toId },
    });
    await tx.userMerge.create({ data: { fromUserId: fromId, toUserId: toId } });
    await tx.user.delete({ where: { id: fromId } });
  });
}
