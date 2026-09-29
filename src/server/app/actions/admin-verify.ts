// From the website's server actions; here plain functions the API calls.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AccountState,
  VerificationStatus,
} from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { syncChatMembership } from "@/server/lib/chat-db";
import { db } from "@/server/lib/db";
import { mergeUsers } from "@/server/lib/merge";
import { NOTIFY_USER_SELECT } from "@/server/lib/notify";
import {
  findManagedMatches,
  type ParentOutcome,
  settleAfterChildDecision,
  settleManagedChildren,
} from "@/server/lib/parent-onboarding";
import { AuthError, actionAdmin, type CurrentUser } from "@/server/lib/session";
import { assertTransition } from "@/server/lib/state-machine";
import {
  notifyDecision,
  notifyParentOutcomes,
} from "@/server/lib/verification/decision-notify";
import { deleteAfterFrom } from "@/server/lib/verification/evidence";
import { ROSTER_MATCH_THRESHOLD } from "@/server/lib/verification/roster";
import { notifyVoucher } from "@/server/lib/verification/vouch";

export type AdminActionState = {
  ok: boolean;
  message?:
    | "saved"
    | "forbidden"
    | "validation"
    | "notFound"
    | "conflict"
    | "generic";
  errors?: Record<string, string>;
} | null;

async function admin(): Promise<CurrentUser | null> {
  try {
    return await actionAdmin();
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

function revalidate(requestId?: string) {
  revalidatePath("/[locale]/app/admin/verification", "page");
  if (requestId)
    revalidatePath("/[locale]/app/admin/verification/[id]", "page");
}

// ---------------------------------------------------------------------------
// Decision (§6.5)

const decisionSchema = z
  .object({
    requestId: z.string().min(1),
    decision: z.enum(["APPROVE", "REJECT", "NEEDS_INFO"]),
    note: z.string().trim().max(2000).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.decision !== "APPROVE" && !v.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: v.decision === "REJECT" ? "reasonRequired" : "messageRequired",
      });
    }
  });

const OUTCOME = {
  APPROVE: { status: VerificationStatus.APPROVED, state: AccountState.ACTIVE },
  REJECT: { status: VerificationStatus.REJECTED, state: AccountState.REJECTED },
  NEEDS_INFO: {
    status: VerificationStatus.NEEDS_INFO,
    state: AccountState.NEEDS_INFO,
  },
} as const;

export async function decideVerificationAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const me = await admin();
  if (!me) return { ok: false, message: "forbidden" };
  const parsed = decisionSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[i.path.join(".")] ??= i.message;
    return { ok: false, message: "validation", errors };
  }
  const { requestId, decision, note } = parsed.data;
  const outcome = OUTCOME[decision];

  const request = await db.verificationRequest.findUnique({
    where: { id: requestId },
    include: {
      user: {
        select: { ...NOTIFY_USER_SELECT, state: true, managedById: true },
      },
    },
  });
  if (!request) return { ok: false, message: "notFound" };
  if (request.status !== VerificationStatus.PENDING)
    return { ok: false, message: "conflict" };

  const decidedAt = new Date();
  let parents: ParentOutcome[] = [];
  try {
    assertTransition(request.user.state, outcome.state);
    await db.$transaction(async (tx) => {
      const updated = await tx.verificationRequest.updateMany({
        where: { id: requestId, status: VerificationStatus.PENDING },
        data: {
          status: outcome.status,
          decidedAt,
          reviewerId: me.id,
          reviewNote: note || null,
        },
      });
      if (updated.count !== 1) throw new ConflictError();
      const moved = await tx.user.updateMany({
        where: { id: request.userId, state: request.user.state },
        data: { state: outcome.state },
      });
      if (moved.count !== 1) throw new ConflictError();

      // Evidence is kept 30 days after a final decision (§6.3). NEEDS_INFO is
      // not final: the applicant may still replace files.
      if (decision !== "NEEDS_INFO") {
        await tx.verificationEvidence.updateMany({
          where: { requestId },
          data: { deleteAfter: deleteAfterFrom(decidedAt) },
        });
      }

      if (
        decision === "APPROVE" &&
        request.rosterRowId &&
        (request.rosterScore ?? 0) >= ROSTER_MATCH_THRESHOLD
      ) {
        await tx.rosterEntry.updateMany({
          where: { id: request.rosterRowId, claimedByUserId: null },
          data: { claimedByUserId: request.userId },
        });
      }
      // §8: for minors, this admin approval also serves as the admin
      // confirmation — no separate step is required, so nothing extra is stored.

      // Older parent applications: their children had none of their own.
      await settleManagedChildren(tx, request.userId, decision, decidedAt);
      // Parents follow their children's approval (they aren't reviewed).
      parents = await settleAfterChildDecision(
        tx,
        request.userId,
        decision,
        note || null,
        decidedAt,
      );
    });
  } catch (e) {
    if (e instanceof ConflictError) return { ok: false, message: "conflict" };
    console.error("[admin-verify] decision failed", e);
    return { ok: false, message: "generic" };
  }

  await audit(
    me.id,
    `verification.${decision.toLowerCase()}`,
    { type: "VerificationRequest", id: requestId },
    {
      userId: request.userId,
      note: note || null,
    },
  );

  // Approved members join their group chats right away (best-effort).
  for (const id of [request.userId, ...parents.map((p) => p.parentId)])
    await syncChatMembership(id).catch((e) =>
      console.error("[admin-verify] chat sync failed", e),
    );

  // A child registered by a parent can't sign in: the parent hears instead.
  if (!request.user.managedById)
    await notifyDecision(request.user, requestId, decision, note || null);
  await notifyParentOutcomes(parents);

  revalidate(requestId);
  return { ok: true, message: "saved" };
}

class ConflictError extends Error {}

// ---------------------------------------------------------------------------
// Manual vouchers (§6.4.2)

const addVoucherSchema = z.object({
  requestId: z.string().min(1),
  voucherId: z.string().min(1),
});

export async function addVoucherAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const me = await admin();
  if (!me) return { ok: false, message: "forbidden" };
  const parsed = addVoucherSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "validation" };
  const { requestId, voucherId } = parsed.data;

  const [request, voucher] = await Promise.all([
    db.verificationRequest.findUnique({
      where: { id: requestId },
      select: { userId: true, status: true },
    }),
    db.user.findUnique({ where: { id: voucherId }, select: { state: true } }),
  ]);
  if (!request || !voucher) return { ok: false, message: "notFound" };
  if (voucher.state !== AccountState.ACTIVE || voucherId === request.userId) {
    return { ok: false, message: "validation" };
  }
  if (
    request.status !== VerificationStatus.PENDING &&
    request.status !== VerificationStatus.NEEDS_INFO
  ) {
    return { ok: false, message: "conflict" };
  }
  const vouch = await db.vouch
    .create({ data: { requestId, voucherId } })
    .catch(() => null);
  if (!vouch) return { ok: false, message: "conflict" };
  await audit(
    me.id,
    "verification.voucher.add",
    { type: "VerificationRequest", id: requestId },
    { voucherId },
  );
  await notifyVoucher(vouch.id);
  revalidate(requestId);
  return { ok: true, message: "saved" };
}

/**
 * Admin: an applicant who signs up themselves was already registered by a
 * parent. Merge the parent-managed record into the applicant's account
 * (keeping the one they sign in to); then decide the application as usual.
 */
export async function mergeManagedIntoApplicantAction(
  fd: FormData,
): Promise<void> {
  const me = await admin();
  if (!me) return;
  const requestId = z.string().min(1).max(64).parse(fd.get("requestId"));
  const managedId = z.string().min(1).max(64).parse(fd.get("managedId"));
  const request = await db.verificationRequest.findUnique({
    where: { id: requestId },
    select: {
      userId: true,
      user: {
        select: {
          nameRomaji: true,
          nameKanji: true,
          nameAtAis: true,
          dateOfBirth: true,
        },
      },
    },
  });
  if (!request) return;
  // Only an actual match can be merged from here.
  const matches = await findManagedMatches(
    {
      names: [
        request.user.nameRomaji,
        request.user.nameKanji,
        request.user.nameAtAis,
      ],
      dateOfBirth: request.user.dateOfBirth,
    },
    request.userId,
  );
  if (!matches.some((m) => m.id === managedId)) return;
  await db.user.update({
    where: { id: managedId },
    data: { managedById: null },
  });
  await mergeUsers(managedId, request.userId);
  await audit(
    me.id,
    "user.merge.managed_into_applicant",
    { type: "User", id: request.userId },
    { fromUserId: managedId, requestId },
  );
  revalidatePath(`/[locale]/app/admin/verification/${requestId}`, "page");
}
