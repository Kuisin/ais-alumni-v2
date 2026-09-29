// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { z } from "zod";
import {
  AccountState,
  ChangeRequestStatus,
} from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { syncChatMembership } from "@/server/lib/chat-db";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { NOTIFY_USER_SELECT, notify, notifyMany } from "@/server/lib/notify";
import { AuthError, actionActive, actionAdmin } from "@/server/lib/session";

/**
 * Birth dates are fixed once a member is approved, like names: members ask
 * the committee to set or correct theirs, and approving applies it (which
 * also updates the 18歳以上 chat). `message` is a key in "profile"
 * (members) or "adminMembers" (admins).
 */
export type BirthDateRequestState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<"dateOfBirth" | "reason", string>>;
  values?: { dateOfBirth: string; reason: string };
} | null;

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return (
      !Number.isNaN(d.getTime()) &&
      ymd(d) === v &&
      d.getUTCFullYear() >= 1900 &&
      d.getTime() <= Date.now()
    );
  }, "invalidDate");

/** Member: ask for a birth date change (one open request at a time). */
export async function submitBirthDateRequestAction(
  _prev: BirthDateRequestState,
  fd: FormData,
): Promise<BirthDateRequestState> {
  let me: Awaited<ReturnType<typeof actionActive>>;
  try {
    me = await actionActive();
  } catch (e) {
    if (e instanceof AuthError)
      return { ok: false, message: "errors.forbidden" };
    throw e;
  }
  const values = {
    dateOfBirth: String(fd.get("dateOfBirth") ?? ""),
    reason: String(fd.get("reason") ?? "").trim(),
  };
  const fieldErrors: NonNullable<BirthDateRequestState>["fieldErrors"] = {};
  const date = dateSchema.safeParse(values.dateOfBirth);
  if (!date.success) fieldErrors.dateOfBirth = "invalidDate";
  // A reason is needed to change a recorded date, not to add a missing one.
  if (me.dateOfBirth && !values.reason) fieldErrors.reason = "required";
  if (values.reason.length > 1000) fieldErrors.reason = "tooLong";
  if (!date.success || Object.keys(fieldErrors).length)
    return { ok: false, message: "errors.validation", fieldErrors, values };
  if (ymd(me.dateOfBirth) === date.data)
    return { ok: false, message: "birthDate.errors.unchanged", values };
  const open = await db.birthDateRequest.count({
    where: { userId: me.id, status: ChangeRequestStatus.PENDING },
  });
  if (open > 0) return { ok: false, message: "birthDate.errors.pending" };

  await db.birthDateRequest.create({
    data: {
      userId: me.id,
      current: me.dateOfBirth,
      proposed: new Date(`${date.data}T00:00:00Z`),
      reason: values.reason,
    },
  });
  const admins = await db.user.findMany({
    where: { isAdmin: true, state: AccountState.ACTIVE },
    select: NOTIFY_USER_SELECT,
  });
  await notifyMany(admins, {
    kind: "BIRTH_DATE_REQUEST_ADMIN",
    path: "/app/admin/name-requests",
    params: (locale) => ({ name: displayName(me, locale) }),
  }).catch((e) => console.error("[birth-date] admin notify failed", e));
  refresh();
  return { ok: true, message: "birthDate.submitted" };
}

/** Member: withdraw their open request. */
export async function cancelBirthDateRequestAction(
  fd: FormData,
): Promise<void> {
  const me = await actionActive();
  const id = z.string().min(1).max(64).parse(fd.get("id"));
  await db.birthDateRequest.updateMany({
    where: { id, userId: me.id, status: ChangeRequestStatus.PENDING },
    data: { status: ChangeRequestStatus.CANCELLED, decidedAt: new Date() },
  });
  refresh();
}

const decisionSchema = z
  .object({
    id: z.string().min(1).max(64),
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().trim().max(1000, "tooLong"),
  })
  .refine((d) => d.decision === "APPROVE" || d.note.length > 0, {
    path: ["note"],
    message: "required",
  });

/** Admin: approve (apply the birth date) or reject with a note. */
export async function decideBirthDateRequestAction(
  _prev: BirthDateRequestState,
  fd: FormData,
): Promise<BirthDateRequestState> {
  let admin: Awaited<ReturnType<typeof actionAdmin>>;
  try {
    admin = await actionAdmin();
  } catch (e) {
    if (e instanceof AuthError)
      return { ok: false, message: "errors.forbidden" };
    throw e;
  }
  const parsed = decisionSchema.safeParse({
    id: fd.get("id"),
    decision: fd.get("decision"),
    note: String(fd.get("note") ?? ""),
  });
  if (!parsed.success)
    return { ok: false, message: "nameRequests.errors.noteRequired" };
  const { id, decision, note } = parsed.data;
  const approved = decision === "APPROVE";

  const request = await db.$transaction(async (tx) => {
    const req = await tx.birthDateRequest.findUnique({ where: { id } });
    if (!req || req.status !== ChangeRequestStatus.PENDING) return null;
    if (approved)
      await tx.user.update({
        where: { id: req.userId },
        data: { dateOfBirth: req.proposed },
      });
    return tx.birthDateRequest.update({
      where: { id },
      data: {
        status: approved
          ? ChangeRequestStatus.APPROVED
          : ChangeRequestStatus.REJECTED,
        reviewerId: admin.id,
        reviewNote: note || null,
        decidedAt: new Date(),
      },
      include: { user: { select: NOTIFY_USER_SELECT } },
    });
  });
  if (!request) return { ok: false, message: "nameRequests.errors.decided" };

  // The birth date decides the 18歳以上 group chat.
  if (approved)
    await syncChatMembership(request.userId).catch((e) =>
      console.error("[birth-date] chat sync failed", e),
    );
  await audit(
    admin.id,
    approved ? "birth_date_request.approved" : "birth_date_request.rejected",
    { type: "User", id: request.userId },
    {
      requestId: id,
      from: ymd(request.current),
      to: ymd(request.proposed),
      note: note || null,
    },
  );
  await notify(request.user, {
    kind: approved
      ? "BIRTH_DATE_REQUEST_APPROVED"
      : "BIRTH_DATE_REQUEST_REJECTED",
    refId: id,
    path: "/app/profile#birth-date",
    note: note || null,
  }).catch((e) => console.error("[birth-date] member notify failed", e));
  refresh();
  return {
    ok: true,
    message: approved ? "nameRequests.approved" : "nameRequests.rejected",
  };
}
