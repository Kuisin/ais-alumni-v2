import type { Prisma } from "@/server/generated/prisma/client";
import { NewsPollKind } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { parseJstLocal, toJstLocalInput } from "@/server/lib/format";
import { deadlineFrom, leaseUntil } from "@/server/lib/jobs/budget";
import { approvedWhere, targetedRecipients } from "@/server/lib/news";
import {
  type Asks,
  type AttachmentItem,
  asksAnything,
  hasResponded,
  isAttachmentKey,
  isOpen,
  type PollInput,
  REACTIONS,
  reminderDue,
  type ScheduleInput,
  tally,
  type Vote,
} from "@/server/lib/news-hub";
import { type NotifyUser, notifyBatch } from "@/server/lib/notify";
import { signedFileUrl } from "@/server/lib/storage";
import { statEvidence } from "@/server/lib/verification/evidence";

type Tx = Prisma.TransactionClient;

type OptionInput = { id?: string; label: string; startsAt: Date | null };

async function savePoll(
  tx: Tx,
  postId: string,
  kind: NewsPollKind,
  input: { question: string; multiple: boolean; options: OptionInput[] } | null,
) {
  const existing = await tx.newsPoll.findUnique({
    where: { postId_kind: { postId, kind } },
    select: { id: true, options: { select: { id: true } } },
  });
  if (!input) {
    if (existing) await tx.newsPoll.delete({ where: { id: existing.id } });
    return;
  }
  const poll = existing
    ? await tx.newsPoll.update({
        where: { id: existing.id },
        data: { question: input.question, multiple: input.multiple },
        select: { id: true },
      })
    : await tx.newsPoll.create({
        data: {
          postId,
          kind,
          question: input.question,
          multiple: input.multiple,
        },
        select: { id: true },
      });
  const known = new Set(existing?.options.map((o) => o.id) ?? []);
  const kept = new Set(
    input.options.flatMap((o) => (o.id && known.has(o.id) ? [o.id] : [])),
  );
  // Removing a choice removes its votes (cascade).
  await tx.newsPollOption.deleteMany({
    where: { pollId: poll.id, id: { notIn: [...kept] } },
  });
  for (const [position, o] of input.options.entries()) {
    const data = { label: o.label, startsAt: o.startsAt, position };
    if (o.id && kept.has(o.id))
      await tx.newsPollOption.update({ where: { id: o.id }, data });
    else await tx.newsPollOption.create({ data: { ...data, pollId: poll.id } });
  }
  // A single-choice poll keeps at most one vote per member.
  if (kind === NewsPollKind.POLL && !input.multiple) {
    const votes = await tx.newsPollVote.findMany({
      where: { pollId: poll.id },
      orderBy: { votedAt: "desc" },
      select: { optionId: true, userId: true },
    });
    const seen = new Set<string>();
    for (const v of votes) {
      if (seen.has(v.userId))
        await tx.newsPollVote.delete({
          where: {
            optionId_userId: { optionId: v.optionId, userId: v.userId },
          },
        });
      seen.add(v.userId);
    }
  }
}

export type HubInput = {
  poll: PollInput | null;
  schedule: ScheduleInput | null;
  attachments: AttachmentItem[];
};

/**
 * Save a post's poll, 日程調整 and attachments. New attachment keys are
 * checked in storage first (checkNewAttachments). Returns the storage keys of
 * removed attachments, to delete after the transaction commits.
 */
export async function saveHub(
  tx: Tx,
  postId: string,
  input: HubInput,
): Promise<string[]> {
  await savePoll(
    tx,
    postId,
    NewsPollKind.POLL,
    input.poll && {
      question: input.poll.question,
      multiple: input.poll.multiple,
      options: input.poll.options.map((o) => ({ ...o, startsAt: null })),
    },
  );
  await savePoll(
    tx,
    postId,
    NewsPollKind.SCHEDULE,
    input.schedule && {
      question: input.schedule.question,
      multiple: true,
      options: input.schedule.options.map((o) => ({
        id: o.id,
        label: o.label,
        startsAt: parseJstLocal(o.startsAt),
      })),
    },
  );

  const current = await tx.newsAttachment.findMany({
    where: { postId },
    select: { id: true, storageKey: true },
  });
  const keepIds = new Set(input.attachments.flatMap((a) => a.id ?? []));
  const removed = current.filter((a) => !keepIds.has(a.id));
  if (removed.length)
    await tx.newsAttachment.deleteMany({
      where: { id: { in: removed.map((a) => a.id) } },
    });
  for (const [position, a] of input.attachments.entries()) {
    if (a.id && current.some((c) => c.id === a.id))
      await tx.newsAttachment.update({
        where: { id: a.id },
        data: { position },
      });
    else if (a.key)
      await tx.newsAttachment.create({
        data: {
          postId,
          storageKey: a.key,
          fileName: a.fileName,
          mimeType: a.mimeType,
          size: a.size,
          position,
        },
      });
  }
  return removed.map((a) => a.storageKey);
}

/** New uploads must be news files that really exist, with an allowed type. */
export async function checkNewAttachments(
  items: readonly AttachmentItem[],
): Promise<boolean> {
  for (const a of items) {
    if (a.id) continue;
    if (!a.key || !isAttachmentKey(a.key)) return false;
    const stat = await statEvidence(a.key);
    if (!stat || stat.size <= 0 || stat.contentType !== a.mimeType)
      return false;
  }
  return true;
}

/** What the post asks members to do. */
export async function asksOf(post: {
  id: string;
  requireConfirm: boolean;
}): Promise<Asks> {
  const polls = await db.newsPoll.findMany({
    where: { postId: post.id },
    select: { id: true },
  });
  return { confirm: post.requireConfirm, pollIds: polls.map((p) => p.id) };
}

/** Audience members and whether each has answered. */
export async function responses(post: {
  id: string;
  requireConfirm: boolean;
  audience: unknown;
  targetAudiences: Parameters<typeof targetedRecipients>[0]["targetAudiences"];
  targetRoles: Parameters<typeof targetedRecipients>[0]["targetRoles"];
}): Promise<{ asks: Asks; members: NotifyUser[]; pending: NotifyUser[] }> {
  const [asks, members] = await Promise.all([
    asksOf(post),
    targetedRecipients(post),
  ]);
  const [confirms, votes] = await Promise.all([
    db.newsConfirm.findMany({
      where: { postId: post.id },
      select: { userId: true },
    }),
    db.newsPollVote.findMany({
      where: { pollId: { in: [...asks.pollIds] } },
      select: { userId: true, pollId: true },
      distinct: ["userId", "pollId"],
    }),
  ]);
  const confirmed = new Set(confirms.map((c) => c.userId));
  const voted = new Map<string, Set<string>>();
  for (const v of votes) {
    const s = voted.get(v.userId) ?? new Set<string>();
    s.add(v.pollId);
    voted.set(v.userId, s);
  }
  const pending = members.filter(
    (m) =>
      !hasResponded(asks, {
        confirmed: confirmed.has(m.id),
        votedPollIds: voted.get(m.id) ?? new Set(),
      }),
  );
  return { asks, members, pending };
}

/**
 * One reminder a day before the deadline to members who haven't answered
 * (no content, like every notification). Run every minute by the
 * publish-news job. Each post is claimed with remindedAt plus a lease
 * (remindingUntil); a reminder that fails, stops at `deadline` or whose
 * call is killed is picked up again once the lease is out, and per-member
 * dedupe sends only to those not reached yet.
 */
export async function sendDeadlineReminders(
  now: Date = new Date(),
  opts: { deadline?: number } = {},
): Promise<{ posts: number; recipients: number; unfinished: number }> {
  const deadline = opts.deadline ?? deadlineFrom();
  const candidates = await db.newsPost.findMany({
    where: {
      deadline: { gt: now },
      closedAt: null,
      archivedAt: null,
      publishedAt: { lte: now },
      AND: [approvedWhere],
      OR: [
        { remindedAt: null },
        { remindedAt: { not: null }, remindingUntil: { lt: now } },
      ],
    },
  });
  let posts = 0;
  let recipients = 0;
  let unfinished = 0;
  for (const post of candidates) {
    if (Date.now() > deadline) {
      unfinished++;
      continue;
    }
    const resuming = post.remindedAt !== null;
    if (!resuming && !reminderDue(post, now)) continue;
    // Claim first so two runs can't both send.
    const claimed = await db.$executeRaw`
      UPDATE "NewsPost"
      SET "remindedAt" = COALESCE("remindedAt", ${now}),
          "remindingUntil" = ${leaseUntil()}
      WHERE id = ${post.id}
        AND ("remindedAt" IS NULL OR "remindingUntil" < ${new Date()})`;
    if (!claimed) continue;
    let done = false;
    try {
      const { asks, pending } = await responses(post);
      if (!asksAnything(asks) || pending.length === 0) done = true;
      else {
        const res = await notifyBatch(
          pending,
          {
            kind: "NEWS_REMINDER",
            refId: post.id,
            dedupe: true,
            path: `/app/news/${post.id}`,
          },
          { deadline },
        );
        done = res.failed.length === 0 && res.remaining.length === 0;
        posts++;
        recipients += res.sent.size;
      }
    } catch (e) {
      console.error(`[news-hub] reminder ${post.id} failed`, e);
    } finally {
      // Finished → no lease; otherwise expire it so the next call retries.
      await db.$executeRaw`
        UPDATE "NewsPost"
        SET "remindingUntil" = ${done ? null : new Date()}
        WHERE id = ${post.id}`;
    }
    if (!done) unfinished++;
  }
  return { posts, recipients, unfinished };
}

export type HubView = Awaited<ReturnType<typeof loadHub>>;

/** Everything the member page shows under a post. */
export async function loadHub(
  post: { id: string; requireConfirm: boolean; allowComments: boolean },
  viewer: { id: string; isAdmin: boolean },
) {
  const [polls, confirm, confirmCount, reactions, comments, attachments] =
    await Promise.all([
      db.newsPoll.findMany({
        where: { postId: post.id },
        orderBy: { kind: "asc" },
        select: {
          id: true,
          kind: true,
          question: true,
          multiple: true,
          options: {
            orderBy: { position: "asc" },
            select: { id: true, label: true, startsAt: true },
          },
          votes: {
            select: {
              optionId: true,
              answer: true,
              userId: true,
              user: { select: { nameRomaji: true, nameKanji: true } },
            },
          },
        },
      }),
      db.newsConfirm.findUnique({
        where: { postId_userId: { postId: post.id, userId: viewer.id } },
        select: { confirmedAt: true },
      }),
      db.newsConfirm.count({ where: { postId: post.id } }),
      db.newsReaction.findMany({
        where: { postId: post.id },
        select: { emoji: true, userId: true },
      }),
      post.allowComments || viewer.isAdmin
        ? db.newsComment.findMany({
            where: {
              postId: post.id,
              ...(viewer.isAdmin ? {} : { hiddenAt: null }),
            },
            orderBy: { createdAt: "asc" },
            take: 500,
            select: {
              id: true,
              body: true,
              createdAt: true,
              hiddenAt: true,
              userId: true,
              user: { select: { nameRomaji: true, nameKanji: true } },
            },
          })
        : [],
      db.newsAttachment.findMany({
        where: { postId: post.id },
        orderBy: { position: "asc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          size: true,
          storageKey: true,
        },
      }),
    ]);

  const name = (u: { nameRomaji: string | null; nameKanji: string | null }) =>
    u.nameRomaji ?? u.nameKanji ?? "—";

  return {
    confirmedAt: confirm?.confirmedAt ?? null,
    confirmCount,
    polls: polls.map((p) => {
      const counts = tally(
        p.options.map((o) => o.id),
        p.votes as { optionId: string; answer: Vote }[],
      );
      const mine = new Map(
        p.votes
          .filter((v) => v.userId === viewer.id)
          .map((v) => [v.optionId, v.answer as Vote]),
      );
      const voters = new Set(p.votes.map((v) => v.userId)).size;
      return {
        id: p.id,
        kind: p.kind,
        question: p.question,
        multiple: p.multiple,
        voters,
        options: p.options.map((o) => ({
          id: o.id,
          label: o.label,
          startsAt: o.startsAt?.toISOString() ?? null,
          counts: counts.get(o.id) ?? { YES: 0, MAYBE: 0, NO: 0 },
          mine: mine.get(o.id) ?? null,
          // 日程調整 answers are shared with everyone (like 調整さん).
          names:
            p.kind === NewsPollKind.SCHEDULE
              ? p.votes
                  .filter((v) => v.optionId === o.id)
                  .map((v) => ({ name: name(v.user), answer: v.answer }))
              : [],
        })),
      };
    }),
    reactions: REACTIONS.map((emoji) => {
      const rows = reactions.filter((r) => r.emoji === emoji);
      return {
        emoji,
        count: rows.length,
        mine: rows.some((r) => r.userId === viewer.id),
      };
    }),
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      hidden: c.hiddenAt !== null,
      mine: c.userId === viewer.id,
      name: name(c.user),
    })),
    attachments: attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      // Caller has authorized the viewer for this post.
      url: signedFileUrl(a.storageKey, undefined, a.fileName),
    })),
  };
}

/** The editor's starting values for a saved post. */
export async function hubFormValues(post: {
  id: string;
  requireConfirm: boolean;
  allowComments: boolean;
  deadline: Date | null;
}) {
  const [polls, attachments] = await Promise.all([
    db.newsPoll.findMany({
      where: { postId: post.id },
      select: {
        kind: true,
        question: true,
        multiple: true,
        options: {
          orderBy: { position: "asc" },
          select: { id: true, label: true, startsAt: true },
        },
      },
    }),
    db.newsAttachment.findMany({
      where: { postId: post.id },
      orderBy: { position: "asc" },
      select: { id: true, fileName: true, mimeType: true, size: true },
    }),
  ]);
  const poll = polls.find((p) => p.kind === NewsPollKind.POLL);
  const schedule = polls.find((p) => p.kind === NewsPollKind.SCHEDULE);
  return {
    requireConfirm: post.requireConfirm,
    allowComments: post.allowComments,
    deadline: post.deadline ? toJstLocalInput(post.deadline) : "",
    poll: poll
      ? {
          question: poll.question,
          multiple: poll.multiple,
          options: poll.options.map((o) => ({ id: o.id, label: o.label })),
        }
      : null,
    schedule: schedule
      ? {
          question: schedule.question,
          options: schedule.options.map((o) => ({
            id: o.id,
            startsAt: o.startsAt ? toJstLocalInput(o.startsAt) : "",
            label: o.label,
          })),
        }
      : null,
    attachments: attachments.map((a) => ({
      ...a,
      mimeType: a.mimeType as AttachmentItem["mimeType"],
    })),
  };
}

/** Of these posts, the open ones still waiting for the member's answer. */
export async function awaitingResponse(
  userId: string,
  posts: readonly {
    id: string;
    requireConfirm: boolean;
    deadline: Date | null;
    closedAt?: Date | null;
  }[],
  now: Date = new Date(),
): Promise<Set<string>> {
  const open = posts.filter((p) => isOpen(p, now));
  if (open.length === 0) return new Set();
  const ids = open.map((p) => p.id);
  const [polls, confirms, votes] = await Promise.all([
    db.newsPoll.findMany({
      where: { postId: { in: ids } },
      select: { id: true, postId: true },
    }),
    db.newsConfirm.findMany({
      where: { userId, postId: { in: ids } },
      select: { postId: true },
    }),
    db.newsPollVote.findMany({
      where: { userId, poll: { postId: { in: ids } } },
      select: { pollId: true },
      distinct: ["pollId"],
    }),
  ]);
  const confirmed = new Set(confirms.map((c) => c.postId));
  const voted = new Set(votes.map((v) => v.pollId));
  const out = new Set<string>();
  for (const p of open) {
    const asks = {
      confirm: p.requireConfirm,
      pollIds: polls.filter((x) => x.postId === p.id).map((x) => x.id),
    };
    if (
      asksAnything(asks) &&
      !hasResponded(asks, {
        confirmed: confirmed.has(p.id),
        votedPollIds: voted,
      })
    )
      out.add(p.id);
  }
  return out;
}
