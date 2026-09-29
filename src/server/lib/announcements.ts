import { cache } from "react";
import { AccountState } from "@/server/generated/prisma/enums";
import type { effectiveAudiences } from "@/server/lib/audience";
import { db } from "@/server/lib/db";
import { MESSAGES_ENABLED } from "@/server/lib/features";
import { audienceUserWhere, specFromPost } from "@/server/lib/news-audience";
import { visibleNews } from "@/server/lib/news-visibility";
import type { CurrentUser } from "@/server/lib/session";

/**
 * Announcements in the app (§10.4): committee news posts and messages
 * (Broadcasts) sent to members. Notifications carry no content, so members
 * read them here; opening one records the read (read receipts).
 */

export const MESSAGES_PAGE_SIZE = 20;

/** Unread counts for the nav badge and the お知らせ tabs. */
export const unreadCounts = cache(
  async (user: CurrentUser): Promise<{ news: number; messages: number }> => {
    const [messages, news] = await Promise.all([
      MESSAGES_ENABLED
        ? db.broadcastRecipient.count({
            where: {
              userId: user.id,
              readAt: null,
              broadcast: { archivedAt: null },
            },
          })
        : 0,
      // News posted since the member joined that they haven't opened.
      visibleNews(user).then(async (posts) => {
        // Posts shown only to admins (outside their audience) never count.
        const recent = posts.filter(
          (p) =>
            !p.adminView && p.publishedAt && p.publishedAt >= user.createdAt,
        );
        if (recent.length === 0) return 0;
        const read = await db.newsRead.count({
          where: { userId: user.id, postId: { in: recent.map((p) => p.id) } },
        });
        return recent.length - read;
      }),
    ]);
    return { news, messages };
  },
);

/** Messages sent to the member, newest first. */
export async function listMessages(userId: string, page = 1) {
  const [rows, total] = await Promise.all([
    db.broadcastRecipient.findMany({
      where: { userId, broadcast: { archivedAt: null } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * MESSAGES_PAGE_SIZE,
      take: MESSAGES_PAGE_SIZE,
      select: {
        readAt: true,
        broadcast: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            editedAt: true,
            position: true,
            sender: { select: { nameRomaji: true, nameKanji: true } },
          },
        },
      },
    }),
    db.broadcastRecipient.count({
      where: { userId, broadcast: { archivedAt: null } },
    }),
  ]);
  return {
    rows,
    total,
    pages: Math.max(1, Math.ceil(total / MESSAGES_PAGE_SIZE)),
  };
}

/**
 * A message the member may read: a recipient (marked read on first open),
 * the sender, or an admin. Null otherwise.
 */
export async function openMessage(user: CurrentUser, broadcastId: string) {
  if (!broadcastId || broadcastId.length > 64) return null;
  const b = await db.broadcast.findUnique({
    where: { id: broadcastId },
    include: {
      sender: { select: { id: true, nameRomaji: true, nameKanji: true } },
      cohort: { select: { number: true, elementaryEndYear: true } },
    },
  });
  if (!b) return null;
  const mine = await db.broadcastRecipient.findUnique({
    where: { broadcastId_userId: { broadcastId, userId: user.id } },
    select: { readAt: true },
  });
  const manager = b.senderId === user.id || user.isAdmin;
  if (!mine && !manager) return null;
  // Archived messages are hidden from recipients (the sender / admins keep them).
  if (b.archivedAt && !manager) return null;
  if (mine && !mine.readAt) {
    await db.broadcastRecipient.update({
      where: { broadcastId_userId: { broadcastId, userId: user.id } },
      data: { readAt: new Date() },
    });
  }
  return { broadcast: b, isRecipient: Boolean(mine) };
}

/** Record that the member opened a news post (idempotent). */
export async function markNewsRead(userId: string, postId: string) {
  await db.newsRead.upsert({
    where: { postId_userId: { postId, userId } },
    create: { postId, userId },
    update: {},
  });
}

/** News post ids (of the given ones) the member has opened. */
export async function readNewsIds(userId: string, postIds: string[]) {
  if (postIds.length === 0) return new Set<string>();
  const rows = await db.newsRead.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });
  return new Set(rows.map((r) => r.postId));
}

/** Read / total per message, for senders' history lists. */
export async function receiptCounts(broadcastIds: string[]) {
  const out = new Map<string, { read: number; total: number }>();
  if (broadcastIds.length === 0) return out;
  const [totals, reads] = await Promise.all([
    db.broadcastRecipient.groupBy({
      by: ["broadcastId"],
      where: { broadcastId: { in: broadcastIds } },
      _count: { _all: true },
    }),
    db.broadcastRecipient.groupBy({
      by: ["broadcastId"],
      where: { broadcastId: { in: broadcastIds }, readAt: { not: null } },
      _count: { _all: true },
    }),
  ]);
  for (const t of totals)
    out.set(t.broadcastId, {
      total: t._count._all,
      read:
        reads.find((r) => r.broadcastId === t.broadcastId)?._count._all ?? 0,
    });
  return out;
}

/** Who has / hasn't read a message (for its sender and admins). */
export async function messageReceipts(broadcastId: string) {
  const rows = await db.broadcastRecipient.findMany({
    where: { broadcastId },
    orderBy: [{ readAt: "asc" }, { createdAt: "asc" }],
    select: {
      readAt: true,
      user: { select: { id: true, nameRomaji: true, nameKanji: true } },
    },
  });
  return {
    read: rows.filter((r) => r.readAt),
    unread: rows.filter((r) => !r.readAt),
  };
}

/** Read counts per news post, and how many members each is aimed at. */
export async function newsReadStats(
  posts: {
    id: string;
    audience?: unknown;
    targetAudiences: Parameters<
      typeof effectiveAudiences
    >[0]["targetAudiences"];
    targetRoles: Parameters<typeof effectiveAudiences>[0]["targetRoles"];
  }[],
) {
  const out = new Map<string, { read: number; audience: number }>();
  if (posts.length === 0) return out;
  const reads = await db.newsRead.groupBy({
    by: ["postId"],
    where: { postId: { in: posts.map((p) => p.id) } },
    _count: { _all: true },
  });
  for (const p of posts) {
    const audience = await db.user.count({
      where: {
        state: AccountState.ACTIVE,
        ...audienceUserWhere(
          specFromPost({ ...p, audience: p.audience ?? null }),
        ),
      },
    });
    out.set(p.id, {
      read: reads.find((r) => r.postId === p.id)?._count._all ?? 0,
      audience,
    });
  }
  return out;
}

/** Members who opened a news post, most recent first (admins). */
export async function newsReaders(postId: string, take = 200) {
  return db.newsRead.findMany({
    where: { postId },
    orderBy: { readAt: "desc" },
    take,
    select: {
      readAt: true,
      user: { select: { id: true, nameRomaji: true, nameKanji: true } },
    },
  });
}
