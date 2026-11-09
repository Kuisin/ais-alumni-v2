import type {
  ApplicationReplySent,
  ApplicationThread,
  ApplicationThreads,
} from "@contract/onboarding";
import type { Prisma } from "@/server/generated/prisma/client";
import {
  AccountState,
  VerificationStatus,
} from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { ApiError, type Locale, notFound } from "@/server/lib/mobile/http";
import type { CurrentUser } from "@/server/lib/session";
import { assertTransition } from "@/server/lib/state-machine";
import {
  isOpen,
  MESSAGE_MAX,
  notifyReplyToAdmins,
} from "@/server/lib/verification/messages";

/**
 * 「やりとり」 for the applicant (src/server/lib/verification/messages.ts):
 * their own application's thread, and — for a parent — the threads of the
 * child accounts they manage (the child has no sign-in). Any signed-in
 * account (mobileRoute "user"): applicants on the onboarding screens, and
 * parents who are members already (家族).
 */

type Tx = Prisma.TransactionClient;

const THREAD_SELECT = {
  id: true,
  userId: true,
  status: true,
  followsChildren: true,
  applicantReadAt: true,
  user: {
    select: {
      id: true,
      state: true,
      managedById: true,
      nameRomaji: true,
      nameKanji: true,
    },
  },
  messages: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fromAdmin: true,
      authorId: true,
      body: true,
      createdAt: true,
      author: { select: { nameRomaji: true, nameKanji: true } },
    },
  },
} as const satisfies Prisma.VerificationRequestSelect;

type ThreadRow = Prisma.VerificationRequestGetPayload<{
  select: typeof THREAD_SELECT;
}>;

/** Mine to read: my own application, or a child account I manage. */
const readableBy = (me: CurrentUser): Prisma.VerificationRequestWhereInput => ({
  OR: [{ userId: me.id }, { user: { managedById: me.id } }],
});

function unreadOf(r: {
  applicantReadAt: Date | null;
  messages: { fromAdmin: boolean; createdAt: Date }[];
}): number {
  return r.messages.filter(
    (m) =>
      m.fromAdmin && (!r.applicantReadAt || m.createdAt > r.applicantReadAt),
  ).length;
}

function threadView(
  me: CurrentUser,
  r: ThreadRow,
  locale: Locale,
): ApplicationThread {
  const child = r.userId !== me.id;
  return {
    requestId: r.id,
    subject: child ? "child" : "self",
    childName: child ? displayName(r.user, locale) : null,
    status: r.status,
    canReply: isOpen(r.status),
    unread: unreadOf(r),
    messages: r.messages.map((m) => ({
      id: m.id,
      fromAdmin: m.fromAdmin,
      mine: m.authorId === me.id,
      author: m.fromAdmin
        ? null
        : m.author
          ? displayName(m.author, locale)
          : null,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/** Threads worth showing: with messages, or asking for more information. */
export async function applicationThreads(
  me: CurrentUser,
  locale: Locale,
): Promise<ApplicationThreads> {
  const rows = await db.verificationRequest.findMany({
    where: {
      AND: [
        readableBy(me),
        {
          OR: [
            { messages: { some: {} } },
            { status: VerificationStatus.NEEDS_INFO },
          ],
        },
      ],
    },
    orderBy: { submittedAt: "asc" },
    select: THREAD_SELECT,
  });
  // My own first, then the children's. A parent-only application asked
  // nothing itself (it followed a child into NEEDS_INFO): the question is
  // in the child's thread.
  const shown = rows
    .filter((r) => r.messages.length > 0 || !r.followsChildren)
    .sort((a, b) => Number(a.userId !== me.id) - Number(b.userId !== me.id));
  return { threads: shown.map((r) => threadView(me, r, locale)) };
}

async function readable(me: CurrentUser, id: string): Promise<ThreadRow> {
  const row = await db.verificationRequest.findFirst({
    where: { AND: [{ id }, readableBy(me)] },
    select: THREAD_SELECT,
  });
  if (!row) throw notFound();
  return row;
}

export async function applicationThread(
  me: CurrentUser,
  id: string,
  locale: Locale,
): Promise<ApplicationThread> {
  return threadView(me, await readable(me, id), locale);
}

/** Opened: the committee's messages so far are read. */
export async function markThreadRead(
  me: CurrentUser,
  id: string,
): Promise<{ ok: true }> {
  await readable(me, id);
  await db.verificationRequest.update({
    where: { id },
    data: { applicantReadAt: new Date() },
  });
  return { ok: true };
}

/**
 * A parent's application that followed a child into NEEDS_INFO
 * (settleAfterChildDecision) goes back to waiting too, once none of the
 * children they manage is still asked for more.
 */
async function resumeFollowingParent(
  tx: Tx,
  parentId: string,
): Promise<boolean> {
  const parent = await tx.user.findUnique({
    where: { id: parentId },
    select: {
      state: true,
      verification: {
        select: { id: true, status: true, followsChildren: true },
      },
    },
  });
  const req = parent?.verification;
  if (
    parent?.state !== AccountState.NEEDS_INFO ||
    !req?.followsChildren ||
    req.status !== VerificationStatus.NEEDS_INFO
  )
    return false;
  const stillAsked = await tx.user.count({
    where: { managedById: parentId, state: AccountState.NEEDS_INFO },
  });
  if (stillAsked) return false;
  assertTransition(parent.state, AccountState.PENDING_REVIEW);
  await tx.verificationRequest.update({
    where: { id: req.id },
    data: { status: VerificationStatus.PENDING, decidedAt: null },
  });
  const moved = await tx.user.updateMany({
    where: { id: parentId, state: AccountState.NEEDS_INFO },
    data: { state: AccountState.PENDING_REVIEW },
  });
  return moved.count === 1;
}

/**
 * Reply. On a NEEDS_INFO application it goes back to review: the request
 * to PENDING and the account NEEDS_INFO → PENDING_REVIEW (the applicant may
 * instead correct and resubmit the application, as before). The committee
 * hears once per turn.
 */
export async function replyToThread(
  me: CurrentUser,
  id: string,
  rawBody: string,
  locale: Locale,
): Promise<ApplicationReplySent> {
  const body = rawBody.trim();
  if (!body || body.length > MESSAGE_MAX) throw new ApiError(400, "invalid");
  const row = await readable(me, id);
  if (!isOpen(row.status)) throw new ApiError(409, "closed");
  const now = new Date();
  let resumed = false;
  await db.$transaction(async (tx) => {
    await tx.verificationMessage.create({
      data: { requestId: id, authorId: me.id, fromAdmin: false, body },
    });
    await tx.verificationRequest.update({
      where: { id },
      data: { applicantReadAt: now },
    });
    if (row.status !== VerificationStatus.NEEDS_INFO) return;
    const reopened = await tx.verificationRequest.updateMany({
      where: { id, status: VerificationStatus.NEEDS_INFO },
      data: {
        status: VerificationStatus.PENDING,
        decidedAt: null,
        reviewerId: null,
      },
    });
    if (reopened.count !== 1) return;
    let accountMoved = false;
    if (row.user.state === AccountState.NEEDS_INFO) {
      assertTransition(row.user.state, AccountState.PENDING_REVIEW);
      const moved = await tx.user.updateMany({
        where: { id: row.userId, state: AccountState.NEEDS_INFO },
        data: { state: AccountState.PENDING_REVIEW },
      });
      accountMoved = moved.count === 1;
    }
    const parentResumed = row.user.managedById
      ? await resumeFollowingParent(tx, row.user.managedById)
      : false;
    // The signed-in account changed state: its own, or (as the managing
    // parent) the application that followed the child.
    resumed = (row.userId === me.id && accountMoved) || parentResumed;
  });
  await notifyReplyToAdmins(id, body);
  return {
    thread: threadView(me, await readable(me, id), locale),
    resumed,
  };
}

/** 家族: each managed child's thread, for 「申請についての質問」. */
export async function managedThreadSummaries(
  parentId: string,
): Promise<Map<string, { requestId: string; unread: number; open: boolean }>> {
  const rows = await db.verificationRequest.findMany({
    where: {
      user: { managedById: parentId },
      OR: [
        { messages: { some: {} } },
        { status: VerificationStatus.NEEDS_INFO },
      ],
    },
    select: {
      id: true,
      userId: true,
      status: true,
      applicantReadAt: true,
      messages: {
        where: { fromAdmin: true },
        select: { fromAdmin: true, createdAt: true },
      },
    },
  });
  return new Map(
    rows.map((r) => [
      r.userId,
      { requestId: r.id, unread: unreadOf(r), open: isOpen(r.status) },
    ]),
  );
}
