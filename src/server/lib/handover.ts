import { createHash, randomBytes } from "node:crypto";
import {
  AccountState,
  VerificationStatus,
} from "@/server/generated/prisma/enums";
import type { AppLocale } from "@/server/i18n/routing";
import { getTranslatorFor } from "@/server/i18n/translator";
import { audit } from "@/server/lib/audit";
import { normalizeEmail } from "@/server/lib/auth/otp";
import { db } from "@/server/lib/db";
import { sendEmail } from "@/server/lib/email";
import { displayName } from "@/server/lib/format";
import { mergeUsers } from "@/server/lib/merge";
import { NOTIFY_USER_SELECT, notify } from "@/server/lib/notify";
import type { CurrentUser } from "@/server/lib/session";
import { syncMemberStatus } from "@/server/lib/status-sync";
import { publicUrl } from "@/server/lib/urls";

/**
 * Handing a parent-managed child account over to the child (§8).
 *
 * The parent enters the child's email; the child gets a one-time link (7
 * days). Opening it and confirming attaches that email to the account and
 * ends parent management, so the child signs in with an email code as usual.
 * If the email already belongs to an account (the child signed up anyway),
 * the managed account is merged into it instead, keeping the child's own.
 */

export const HANDOVER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export type StartHandoverResult =
  | { ok: true }
  | { ok: false; error: "notFound" | "invalidEmail" | "notActive" };

export async function startHandover(
  parent: CurrentUser,
  childId: string,
  rawEmail: string,
  now: Date = new Date(),
): Promise<StartHandoverResult> {
  const email = normalizeEmail(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)
    return { ok: false, error: "invalidEmail" };
  const child = await db.user.findFirst({
    where: { id: childId, managedById: parent.id },
    select: {
      id: true,
      state: true,
      locale: true,
      nameRomaji: true,
      nameKanji: true,
    },
  });
  if (!child) return { ok: false, error: "notFound" };
  // Only approved records are handed over (the committee has checked them).
  if (child.state !== AccountState.ACTIVE)
    return { ok: false, error: "notActive" };

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    // A new link replaces any earlier unused one.
    db.childHandover.deleteMany({ where: { childId, usedAt: null } }),
    db.childHandover.create({
      data: {
        childId,
        parentId: parent.id,
        email,
        tokenHash: hash(token),
        expiresAt: new Date(now.getTime() + HANDOVER_TTL_MS),
      },
    }),
  ]);
  const locale: AppLocale = child.locale === "en" ? "en" : "ja";
  const t = await getTranslatorFor(locale, "family");
  await sendEmail({
    to: email,
    subject: t("handover.emailMessage.subject"),
    text: t("handover.emailMessage.text", {
      parent: displayName(parent, locale),
      child: displayName(child, locale),
    }),
    url: publicUrl(`/${locale}/app/handover/${token}`),
  });
  await audit(parent.id, "family.handover_started", {
    type: "User",
    id: childId,
  });
  return { ok: true };
}

export async function cancelHandover(parent: CurrentUser, childId: string) {
  await db.childHandover.deleteMany({
    where: { childId, parentId: parent.id, usedAt: null },
  });
}

/** The pending handover for a token, if it can still be used. */
export async function findHandover(token: string, now: Date = new Date()) {
  if (!token || token.length > 100) return null;
  const h = await db.childHandover.findUnique({
    where: { tokenHash: hash(token) },
    include: {
      child: {
        select: {
          id: true,
          managedById: true,
          state: true,
          nameRomaji: true,
          nameKanji: true,
        },
      },
      parent: { select: { nameRomaji: true, nameKanji: true } },
    },
  });
  if (!h || h.usedAt || h.expiresAt <= now || !h.child.managedById) return null;
  return h;
}

export type ClaimResult =
  | { ok: true; email: string; merged: boolean }
  | { ok: false; error: "invalid" };

/** Complete a handover (the emailed link proves the email is the child's). */
export async function claimHandover(
  token: string,
  now: Date = new Date(),
): Promise<ClaimResult> {
  const h = await findHandover(token, now);
  if (!h) return { ok: false, error: "invalid" };
  const used = await db.childHandover.updateMany({
    where: { id: h.id, usedAt: null },
    data: { usedAt: now },
  });
  if (used.count !== 1) return { ok: false, error: "invalid" };

  const existing = await db.user.findUnique({
    where: { primaryEmail: h.email },
    select: { id: true, state: true },
  });
  let childId = h.childId;
  if (!existing) {
    await db.user.update({
      where: { id: h.childId },
      data: { primaryEmail: h.email, emailVerifiedAt: now, managedById: null },
    });
  } else {
    // The child already has an account: keep it and bring the record in.
    await db.user.update({
      where: { id: h.childId },
      data: { managedById: null },
    });
    await mergeUsers(h.childId, existing.id);
    childId = existing.id;
    if (
      existing.state !== AccountState.ACTIVE &&
      h.child.state === AccountState.ACTIVE
    ) {
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.id },
          data: { state: AccountState.ACTIVE },
        });
        // The committee already approved this record through the parent.
        await tx.verificationRequest.updateMany({
          where: {
            userId: existing.id,
            status: {
              in: [VerificationStatus.PENDING, VerificationStatus.NEEDS_INFO],
            },
          },
          data: {
            status: VerificationStatus.APPROVED,
            decidedAt: now,
            reviewNote: "Approved via the parent's registration (handover).",
          },
        });
      });
    }
  }
  await syncMemberStatus(childId);
  await audit(
    null,
    "family.handover_completed",
    { type: "User", id: childId },
    {
      parentId: h.parentId,
      merged: Boolean(existing),
    },
  );

  try {
    const parent = await db.user.findUniqueOrThrow({
      where: { id: h.parentId },
      select: NOTIFY_USER_SELECT,
    });
    await notify(parent, {
      kind: "FAMILY_HANDOVER_DONE",
      refId: h.id,
      path: "/app/family",
      params: (locale) => ({ child: displayName(h.child, locale) }),
    });
  } catch (e) {
    console.error("[handover] parent notification failed", e);
  }
  return { ok: true, email: h.email, merged: Boolean(existing) };
}
