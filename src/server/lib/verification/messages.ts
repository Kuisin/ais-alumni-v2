import type { Prisma } from "@/server/generated/prisma/client";
import {
  AccountState,
  VerificationStatus,
} from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { NOTIFY_USER_SELECT, notify, notifyMany } from "@/server/lib/notify";
import { activeAdmins } from "@/server/lib/notify/staff";

/**
 * 「やりとり」: messages between the committee and an applicant about one
 * application (VerificationMessage). A child account a parent registered
 * has no sign-in: its managing parent reads and answers the child's thread.
 * Open applications (PENDING / NEEDS_INFO) take new messages; an
 * applicant's reply to a NEEDS_INFO application puts it back in review
 * (src/server/lib/mobile/verification-messages.ts).
 */

type Tx = Prisma.TransactionClient;

export const MESSAGE_MAX = 2000;

export const OPEN_STATUSES: VerificationStatus[] = [
  VerificationStatus.PENDING,
  VerificationStatus.NEEDS_INFO,
];

export function isOpen(status: VerificationStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

/** A committee message (also the note of 「追加情報が必要」). */
export async function addAdminMessageInTx(
  tx: Tx,
  requestId: string,
  authorId: string,
  body: string,
): Promise<void> {
  await tx.verificationMessage.create({
    data: { requestId, authorId, fromAdmin: true, body },
  });
}

/**
 * Where the reader answers: a parent's own page for the managed child's
 * thread once approved (家族), else the onboarding screen they're on.
 */
export function threadPath(
  readerState: AccountState,
  requestId: string,
  child: boolean,
): string {
  if (readerState === AccountState.ACTIVE)
    return child ? `/app/family/application/${requestId}` : "/app/dashboard";
  return readerState === AccountState.NEEDS_INFO
    ? "/app/onboarding/verify"
    : "/app/onboarding/status";
}

const READER_SELECT = { ...NOTIFY_USER_SELECT, state: true } as const;

/** Who reads the application's thread: the applicant, or the managing parent. */
async function readerOf(requestId: string) {
  const r = await db.verificationRequest.findUnique({
    where: { id: requestId },
    select: {
      user: {
        select: {
          ...READER_SELECT,
          managedBy: { select: READER_SELECT },
        },
      },
    },
  });
  if (!r) return null;
  const { managedBy, ...applicant } = r.user;
  return managedBy
    ? { to: managedBy, child: applicant }
    : { to: applicant, child: null };
}

/** A committee message → the applicant (or the parent managing the child). */
export async function notifyAdminMessage(
  requestId: string,
  messageId: string,
  body: string,
): Promise<void> {
  try {
    const r = await readerOf(requestId);
    if (!r) return;
    const { state, ...to } = r.to;
    const child = r.child;
    await notify(to, {
      kind: child ? "VERIFICATION_CHILD_MESSAGE" : "VERIFICATION_MESSAGE",
      refId: messageId,
      path: threadPath(state, requestId, Boolean(child)),
      params: child
        ? (locale) => ({ name: displayName(child, locale) })
        : undefined,
      content: body,
    });
  } catch (e) {
    console.error("[verification] message notice failed", e);
  }
}

/**
 * The committee asked about a parent-registered child (NEEDS_INFO): the
 * managing parent always hears, whether their own application is still
 * open or they're a member already. (A parent whose own application
 * followed the child into NEEDS_INFO hears through notifyParentOutcomes.)
 */
export async function notifyChildNeedsInfo(
  requestId: string,
  note: string | null,
): Promise<void> {
  try {
    const r = await readerOf(requestId);
    if (!r?.child) return;
    const { state, ...to } = r.to;
    const child = r.child;
    await notify(to, {
      kind: "VERIFICATION_CHILD_NEEDS_INFO",
      refId: requestId,
      path: threadPath(state, requestId, true),
      params: (locale) => ({ name: displayName(child, locale) }),
      content: note,
    });
  } catch (e) {
    console.error("[verification] child needs-info notice failed", e);
  }
}

/**
 * An applicant's (or managing parent's) reply → the committee. One notice
 * per turn: replies after the same committee message share a refId, so a
 * burst of them sends once.
 */
export async function notifyReplyToAdmins(
  requestId: string,
  body: string,
): Promise<void> {
  try {
    const [r, lastAdmin] = await Promise.all([
      db.verificationRequest.findUnique({
        where: { id: requestId },
        select: {
          user: {
            select: { id: true, nameRomaji: true, nameKanji: true },
          },
        },
      }),
      db.verificationMessage.findFirst({
        where: { requestId, fromAdmin: true },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
    ]);
    if (!r) return;
    const admins = (await activeAdmins()).filter((a) => a.id !== r.user.id);
    await notifyMany(admins, {
      kind: "VERIFICATION_REPLY_ADMIN",
      refId: `${requestId}:${lastAdmin?.id ?? "-"}`,
      dedupe: true,
      path: `/app/admin/verification/${requestId}`,
      params: (locale) => ({ name: displayName(r.user, locale) }),
      content: body,
    });
  } catch (e) {
    console.error("[verification] reply notice failed", e);
  }
}

/**
 * Whether the applicant answered last: their latest message is newer than
 * the committee's (「返信あり」 in the queue).
 */
export function repliedLast(
  latest: { fromAdmin: boolean } | null | undefined,
): boolean {
  return latest ? !latest.fromAdmin : false;
}
