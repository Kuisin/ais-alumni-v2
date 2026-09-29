// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { z } from "zod";
import {
  AccountState,
  ChangeRequestStatus,
} from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { isGender } from "@/server/lib/gender";
import { NOTIFY_USER_SELECT, notify, notifyMany } from "@/server/lib/notify";
import { AuthError, actionActive, actionAdmin } from "@/server/lib/session";

/**
 * 性別 is given in the application and fixed after that, like the birth
 * date: members ask the committee to change it, and approving applies it.
 * Members who joined before it was asked may set it once themselves.
 * `message` is a key in "profile" (members) or "adminMembers" (admins).
 */
export type GenderRequestState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<"gender" | "reason", string>>;
  values?: { gender: string; reason: string };
} | null;

async function member() {
  try {
    return await actionActive();
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

/** Member without a recorded gender: set it once (then it's fixed). */
export async function setGenderOnceAction(
  _prev: GenderRequestState,
  fd: FormData,
): Promise<GenderRequestState> {
  const me = await member();
  if (!me) return { ok: false, message: "errors.forbidden" };
  const gender = fd.get("gender");
  if (!isGender(gender))
    return {
      ok: false,
      message: "errors.validation",
      fieldErrors: { gender: "invalid" },
    };
  const res = await db.user.updateMany({
    where: { id: me.id, gender: null },
    data: { gender },
  });
  if (!res.count) return { ok: false, message: "gender.errors.alreadySet" };
  refresh();
  return { ok: true, message: "gender.saved" };
}

/** Member: ask for a gender change (one open request at a time). */
export async function submitGenderRequestAction(
  _prev: GenderRequestState,
  fd: FormData,
): Promise<GenderRequestState> {
  const me = await member();
  if (!me) return { ok: false, message: "errors.forbidden" };
  const values = {
    gender: String(fd.get("gender") ?? ""),
    reason: String(fd.get("reason") ?? "").trim(),
  };
  const fieldErrors: NonNullable<GenderRequestState>["fieldErrors"] = {};
  if (!isGender(values.gender)) fieldErrors.gender = "invalid";
  if (!values.reason) fieldErrors.reason = "required";
  if (values.reason.length > 1000) fieldErrors.reason = "tooLong";
  if (Object.keys(fieldErrors).length || !isGender(values.gender))
    return { ok: false, message: "errors.validation", fieldErrors, values };
  if (me.gender === values.gender)
    return { ok: false, message: "gender.errors.unchanged", values };
  const open = await db.genderRequest.count({
    where: { userId: me.id, status: ChangeRequestStatus.PENDING },
  });
  if (open > 0) return { ok: false, message: "gender.errors.pending" };

  await db.genderRequest.create({
    data: {
      userId: me.id,
      current: me.gender,
      proposed: values.gender,
      reason: values.reason,
    },
  });
  const admins = await db.user.findMany({
    where: { isAdmin: true, state: AccountState.ACTIVE },
    select: NOTIFY_USER_SELECT,
  });
  await notifyMany(admins, {
    kind: "GENDER_REQUEST_ADMIN",
    path: "/app/admin/name-requests",
    params: (locale) => ({ name: displayName(me, locale) }),
  }).catch((e) => console.error("[gender] admin notify failed", e));
  refresh();
  return { ok: true, message: "gender.submitted" };
}

/** Member: withdraw their open request. */
export async function cancelGenderRequestAction(fd: FormData): Promise<void> {
  const me = await actionActive();
  const id = z.string().min(1).max(64).parse(fd.get("id"));
  await db.genderRequest.updateMany({
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

/** Admin: approve (apply the gender) or reject with a note. */
export async function decideGenderRequestAction(
  _prev: GenderRequestState,
  fd: FormData,
): Promise<GenderRequestState> {
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
    const req = await tx.genderRequest.findUnique({ where: { id } });
    if (!req || req.status !== ChangeRequestStatus.PENDING) return null;
    if (approved)
      await tx.user.update({
        where: { id: req.userId },
        data: { gender: req.proposed },
      });
    return tx.genderRequest.update({
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

  await audit(
    admin.id,
    approved ? "gender_request.approved" : "gender_request.rejected",
    { type: "User", id: request.userId },
    {
      requestId: id,
      from: request.current,
      to: request.proposed,
      note: note || null,
    },
  );
  await notify(request.user, {
    kind: approved ? "GENDER_REQUEST_APPROVED" : "GENDER_REQUEST_REJECTED",
    refId: id,
    path: "/app/profile#gender",
    note: note || null,
  }).catch((e) => console.error("[gender] member notify failed", e));
  refresh();
  return {
    ok: true,
    message: approved ? "nameRequests.approved" : "nameRequests.rejected",
  };
}
