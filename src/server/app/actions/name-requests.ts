// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/server/generated/prisma/client";
import {
  AccountState,
  ChangeRequestStatus,
} from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import {
  type FormNameField,
  nameColumns,
  nameFormInput,
  nameFormSchema,
  namePartsOf,
} from "@/server/lib/names";
import { NOTIFY_USER_SELECT, notify, notifyMany } from "@/server/lib/notify";
import { AuthError, actionActive, actionAdmin } from "@/server/lib/session";

/**
 * Names are fixed once a member is approved (§6). Members ask the committee
 * to change them; approving applies the new name parts. `message` is a key
 * in the "profile" namespace (members) or "adminMembers" (admins).
 */
export type NameRequestState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<FormNameField | "nameAtAis" | "reason", string>>;
  /** what was submitted, so the form keeps it after an error */
  values?: Record<string, string>;
} | null;

const requestSchema = nameFormSchema.extend({
  nameAtAis: z
    .string()
    .trim()
    .max(100, "tooLong")
    .transform((v) => v || null),
  reason: z.string().trim().min(1, "required").max(1000, "tooLong"),
});

export type NameValues = ReturnType<typeof namePartsOf> & { nameAtAis: string };

const valuesOf = (
  u: Parameters<typeof namePartsOf>[0] & { nameAtAis?: string | null },
) => ({
  ...namePartsOf(u),
  nameAtAis: u.nameAtAis ?? "",
});

/** Member: ask for a name change (one open request at a time). */
export async function submitNameRequestAction(
  _prev: NameRequestState,
  fd: FormData,
): Promise<NameRequestState> {
  let me: Awaited<ReturnType<typeof actionActive>>;
  try {
    me = await actionActive();
  } catch (e) {
    if (e instanceof AuthError)
      return { ok: false, message: "errors.forbidden" };
    throw e;
  }
  const input = {
    ...nameFormInput(fd),
    nameAtAis: String(fd.get("nameAtAis") ?? ""),
    reason: String(fd.get("reason") ?? ""),
  };
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: NonNullable<NameRequestState>["fieldErrors"] = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0]) as keyof typeof fieldErrors;
      fieldErrors[k] ??= i.message;
    }
    return {
      ok: false,
      message: "errors.validation",
      fieldErrors,
      values: input,
    };
  }
  const { reason, ...proposedRaw } = parsed.data;
  const proposed = {
    ...namePartsOf(nameColumns(proposedRaw)),
    nameAtAis: proposedRaw.nameAtAis ?? "",
  };
  const current = valuesOf(me);
  if (JSON.stringify(proposed) === JSON.stringify(current)) {
    return {
      ok: false,
      message: "nameRequest.errors.unchanged",
      values: input,
    };
  }
  const open = await db.nameChangeRequest.count({
    where: { userId: me.id, status: ChangeRequestStatus.PENDING },
  });
  if (open > 0) return { ok: false, message: "nameRequest.errors.pending" };

  await db.nameChangeRequest.create({
    data: {
      userId: me.id,
      current: current as Prisma.InputJsonValue,
      proposed: proposed as Prisma.InputJsonValue,
      reason,
    },
  });
  const admins = await db.user.findMany({
    where: { isAdmin: true, state: AccountState.ACTIVE },
    select: NOTIFY_USER_SELECT,
  });
  await notifyMany(admins, {
    kind: "NAME_REQUEST_ADMIN",
    path: "/app/admin/name-requests",
    params: (locale) => ({ name: displayName(me, locale) }),
  }).catch((e) => console.error("[name-requests] admin notify failed", e));
  refresh();
  return { ok: true, message: "nameRequest.submitted" };
}

/** Member: withdraw their open request. */
export async function cancelNameRequestAction(fd: FormData): Promise<void> {
  const me = await actionActive();
  const id = z.string().min(1).max(64).parse(fd.get("id"));
  await db.nameChangeRequest.updateMany({
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

/** Admin: approve (apply the new name) or reject with a note. */
export async function decideNameRequestAction(
  _prev: NameRequestState,
  fd: FormData,
): Promise<NameRequestState> {
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
    const req = await tx.nameChangeRequest.findUnique({ where: { id } });
    if (!req || req.status !== ChangeRequestStatus.PENDING) return null;
    if (approved) {
      const p = req.proposed as NameValues;
      await tx.user.update({
        where: { id: req.userId },
        data: { ...nameColumns(p), nameAtAis: p.nameAtAis || null },
      });
    }
    return tx.nameChangeRequest.update({
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
    approved ? "name_request.approved" : "name_request.rejected",
    { type: "User", id: request.userId },
    { requestId: id, proposed: request.proposed, note: note || null },
  );
  await notify(request.user, {
    kind: approved ? "NAME_REQUEST_APPROVED" : "NAME_REQUEST_REJECTED",
    refId: id,
    path: "/app/profile#name",
    note: note || null,
  }).catch((e) => console.error("[name-requests] member notify failed", e));
  refresh();
  return {
    ok: true,
    message: approved ? "nameRequests.approved" : "nameRequests.rejected",
  };
}
