import type { Prisma } from "@/server/generated/prisma/client";
import { AccountState } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { awaitingApproval } from "@/server/lib/approval";
import { audienceWhere, type Targeted } from "@/server/lib/audience";
import { db } from "@/server/lib/db";
import { localized } from "@/server/lib/format";
import { deadlineFrom, leaseUntil } from "@/server/lib/jobs/budget";
import { markdownToLines } from "@/server/lib/markdown";
import { audienceUserWhere, specFromPost } from "@/server/lib/news-audience";
import {
  NOTIFY_USER_SELECT,
  type NotifyUser,
  notifyBatch,
} from "@/server/lib/notify";
import { refreshUsers } from "@/server/lib/realtime";

export const NEWS_PAGE_SIZE = 10;
export const EVENTS_PAGE_SIZE = 20;

/** Cover images (§10.4). */
// 4 MB: covers go through a server action and Vercel caps request bodies at 4.5 MB.
export const COVER_MAX_BYTES = 4 * 1024 * 1024;
export const COVER_TYPES = { "image/jpeg": "jpg", "image/png": "png" } as const;

/** DB filter for events and news a viewer may see (src/lib/audience.ts). */
export const targetRolesWhere = audienceWhere;

/** Not waiting for a 同窓会委員's approval (see NewsPost.approvalRequired). */
export const approvedWhere: Prisma.NewsPostWhereInput = {
  OR: [{ approvalRequired: false }, { approvedAt: { not: null } }],
};

export { awaitingApproval } from "@/server/lib/approval";

/**
 * Published = publishedAt set, not in the future, not archived, and (for a
 * 同窓会委員's post) approved.
 */
export function publishedWhere(
  now: Date = new Date(),
): Prisma.NewsPostWhereInput {
  return {
    publishedAt: { lte: now },
    archivedAt: null,
    AND: [approvedWhere],
  };
}

/** The same check for one loaded post. */
export function isLive(
  post: {
    publishedAt: Date | null;
    archivedAt: Date | null;
    approvalRequired: boolean;
    approvedAt: Date | null;
  },
  now: Date = new Date(),
): boolean {
  return (
    !!post.publishedAt &&
    post.publishedAt <= now &&
    !post.archivedAt &&
    !awaitingApproval(post)
  );
}

export type NewsStatus = "draft" | "scheduled" | "published";

export function newsStatus(
  post: { publishedAt: Date | null },
  now: Date = new Date(),
): NewsStatus {
  if (!post.publishedAt) return "draft";
  return post.publishedAt > now ? "scheduled" : "published";
}

/**
 * ACTIVE members a post/event with these target roles is aimed at.
 * Assumption: admins are notified only when one of their own roles matches
 * (they can *see* everything, but are not spammed with every announcement).
 */
export async function targetedRecipients(
  target: Targeted & { audience?: unknown },
): Promise<NotifyUser[]> {
  return db.user.findMany({
    where: {
      state: AccountState.ACTIVE,
      ...audienceUserWhere(
        specFromPost({ audience: target.audience ?? null, ...target }),
      ),
    },
    select: NOTIFY_USER_SELECT,
  });
}

/**
 * Send the "new post" notification (kind NEWS, refId post id) once. The post
 * is claimed atomically: notifiedAt marks it notified (the admin button and
 * the cron can never both start it) and notifyingUntil is a lease while it is
 * sent. The send stops starting new batches at `deadline`; if it stops early,
 * fails or the call is killed, the lease is (or runs) out and the cron picks
 * the post up again (dueScheduledNews) — per-member dedupe sends only to
 * those not reached yet. Returns null if it was not published, or already
 * notified / being sent.
 */
export async function sendNewsNotification(
  postId: string,
  now: Date = new Date(),
  opts: { deadline?: number } = {},
): Promise<{ recipients: number; done: boolean; failed: number } | null> {
  const deadline = opts.deadline ?? deadlineFrom();
  // Raw SQL: keeps the first notifiedAt and doesn't touch updatedAt (which
  // tells reserved posts apart, see dueScheduledNews).
  const claimed = await db.$executeRaw`
    UPDATE "NewsPost"
    SET "notifiedAt" = COALESCE("notifiedAt", ${now}),
        "notifyingUntil" = ${leaseUntil()}
    WHERE id = ${postId}
      AND "archivedAt" IS NULL
      AND "publishedAt" <= ${now}
      AND ("approvalRequired" = false OR "approvedAt" IS NOT NULL)
      AND ("notifiedAt" IS NULL OR "notifyingUntil" < ${new Date()})`;
  if (claimed === 0) return null;

  // Finished → no lease; otherwise expire it now so the next cron call
  // retries right away.
  const release = (done: boolean) =>
    db.$executeRaw`
      UPDATE "NewsPost"
      SET "notifyingUntil" = ${done ? null : new Date()}
      WHERE id = ${postId}`;
  try {
    const post = await db.newsPost.findUniqueOrThrow({ where: { id: postId } });
    const users = await targetedRecipients(post);
    const res = await notifyBatch(
      users,
      {
        kind: "NEWS",
        refId: post.id,
        dedupe: true,
        path: `/app/news/${post.id}`,
        // The post's title as the headline and a summary of it (only
        // members it is addressed to get it).
        params: async (locale) => ({
          title:
            localized(post.titleJa, post.titleEn, locale).text ||
            (await getTranslatorFor(locale, "notifications"))("untitledNews"),
        }),
        content: (locale) =>
          markdownToLines(localized(post.bodyJa, post.bodyEn, locale).text),
      },
      { deadline },
    );
    const done = res.failed.length === 0 && res.remaining.length === 0;
    await release(done);
    // Open pages update their unread badges right away.
    await refreshUsers([...res.sent.keys()], "news");
    return { recipients: res.sent.size, done, failed: res.failed.length };
  } catch (e) {
    await release(false);
    throw e;
  }
}

/**
 * Scheduled posts that have now been published but not announced (§10.4),
 * and sends that didn't finish.
 * "Scheduled" = publishedAt was in the future when the post was last saved,
 * i.e. publishedAt > updatedAt (a Prisma field reference). Posts published
 * immediately are announced only through the admin "Publish & notify" step.
 * Posts older than 7 days are ignored so a misconfigured cron can't blast
 * stale news. A 同窓会委員's reserved post waits for approval; approving
 * doesn't touch updatedAt, so it's announced on the next call.
 */
export async function dueScheduledNews(
  now: Date = new Date(),
): Promise<{ id: string }[]> {
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return db.newsPost.findMany({
    where: {
      archivedAt: null,
      publishedAt: { lte: now, gte: week },
      AND: [approvedWhere],
      OR: [
        {
          notifiedAt: null,
          // Reserved with "notify" on (off = publish in the app only).
          notifyOnPublish: true,
          publishedAt: { gt: db.newsPost.fields.updatedAt },
        },
        // Started (cron or the admin button) but not finished: failed,
        // stopped at the time limit, or the call was killed.
        { notifiedAt: { not: null }, notifyingUntil: { lt: now } },
      ],
    },
    select: { id: true },
  });
}
