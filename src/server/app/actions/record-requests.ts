// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/server/generated/prisma/client";
import {
  AccountState,
  ChangeRequestStatus,
  RoleKey,
} from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { cohortNumbersById, ensureCohort } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { NOTIFY_USER_SELECT, notify, notifyMany } from "@/server/lib/notify";
import {
  diffRecord,
  fieldsFor,
  hasRecord,
  parseRecordForm,
  type RecordField,
  type RecordValues,
  snapshot,
  toRoleUpdate,
} from "@/server/lib/record-requests";
import { AuthError, actionActive, actionAdmin } from "@/server/lib/session";
import { syncMemberStatus } from "@/server/lib/status-sync";

export type RecordRequestFormState = {
  ok?: boolean;
  /** key in the "records" namespace */
  message?: string;
  fieldErrors?: Partial<Record<RecordField | "reason", string>>;
} | null;

const reasonSchema = z.string().trim().min(1, "required").max(1000, "tooLong");

function forbidden(e: unknown): RecordRequestFormState {
  if (e instanceof AuthError) return { ok: false, message: "errors.forbidden" };
  throw e;
}

/** Member: propose corrections to one role's AIS record. */
export async function submitRecordRequestAction(
  _prev: RecordRequestFormState,
  fd: FormData,
): Promise<RecordRequestFormState> {
  let me: Awaited<ReturnType<typeof actionActive>>;
  try {
    me = await actionActive();
  } catch (e) {
    return forbidden(e);
  }
  const role = z.enum(RoleKey).safeParse(fd.get("role"));
  const roleRow = role.success
    ? me.roles.find((r) => r.role === role.data)
    : undefined;
  if (!role.success || !roleRow || !hasRecord(role.data)) {
    return { ok: false, message: "errors.invalidRole" };
  }

  const input = Object.fromEntries(
    fieldsFor(role.data).map((f) => [f, String(fd.get(f) ?? "")]),
  );
  const parsed = parseRecordForm(role.data, input);
  const reason = reasonSchema.safeParse(String(fd.get("reason") ?? ""));
  if (!parsed.ok || !reason.success) {
    return {
      ok: false,
      message: "errors.validation",
      fieldErrors: {
        ...(parsed.ok ? {} : parsed.errors),
        ...(reason.success
          ? {}
          : { reason: reason.error.issues[0]?.message ?? "required" }),
      },
    };
  }

  const numbers = await cohortNumbersById();
  const current = snapshot(role.data, {
    ...roleRow,
    cohort: roleRow.cohortId ? (numbers.get(roleRow.cohortId) ?? null) : null,
  });
  const proposed = diffRecord(current, parsed.values);
  if (Object.keys(proposed).length === 0)
    return { ok: false, message: "errors.noChanges" };

  const pending = await db.recordChangeRequest.findFirst({
    where: {
      userId: me.id,
      role: role.data,
      status: ChangeRequestStatus.PENDING,
    },
    select: { id: true },
  });
  if (pending) return { ok: false, message: "errors.pendingExists" };

  await db.recordChangeRequest.create({
    data: {
      userId: me.id,
      role: role.data,
      current: current as Prisma.InputJsonValue,
      proposed: proposed as Prisma.InputJsonValue,
      reason: reason.data,
    },
  });

  // Let admins know; there is no other alert for new requests.
  const admins = await db.user.findMany({
    where: { isAdmin: true, state: AccountState.ACTIVE },
    select: NOTIFY_USER_SELECT,
  });
  await notifyMany(admins, {
    kind: "RECORD_REQUEST_ADMIN",
    path: "/app/admin/record-requests",
    params: (locale) => ({ name: displayName(me, locale) }),
  }).catch((e) => console.error("[record-requests] admin notify failed", e));

  refresh();
  return { ok: true, message: "submitted" };
}

/** Member: withdraw a pending request. */
export async function cancelRecordRequestAction(id: string): Promise<void> {
  const me = await actionActive();
  await db.recordChangeRequest.updateMany({
    where: { id, userId: me.id, status: ChangeRequestStatus.PENDING },
    data: { status: ChangeRequestStatus.CANCELLED, decidedAt: new Date() },
  });
  refresh();
}

const decisionSchema = z
  .object({
    id: z.string().min(1),
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().trim().max(1000, "tooLong"),
  })
  .refine((d) => d.decision === "APPROVE" || d.note.length > 0, {
    path: ["note"],
    message: "required",
  });

/** Admin: approve (apply to the member's record) or reject a request. */
export async function decideRecordRequestAction(
  _prev: RecordRequestFormState,
  fd: FormData,
): Promise<RecordRequestFormState> {
  let admin: Awaited<ReturnType<typeof actionAdmin>>;
  try {
    admin = await actionAdmin();
  } catch (e) {
    return forbidden(e);
  }
  const parsed = decisionSchema.safeParse({
    id: fd.get("id"),
    decision: fd.get("decision"),
    note: String(fd.get("note") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "errors.validation",
      fieldErrors: { reason: "required" },
    };
  }
  const { id, decision, note } = parsed.data;
  const approved = decision === "APPROVE";

  const request = await db.$transaction(async (tx) => {
    const req = await tx.recordChangeRequest.findUnique({ where: { id } });
    if (!req || req.status !== ChangeRequestStatus.PENDING) return null;
    if (approved) {
      // 学年 numbers become cohort rows (created on first use).
      const data = await toRoleUpdate(req.proposed as RecordValues, (n) =>
        ensureCohort(n, tx),
      );
      await tx.userRole.update({
        where: { userId_role: { userId: req.userId, role: req.role } },
        data,
      });
      // Status, grade and graduation follow from the corrected inputs.
      await syncMemberStatus(req.userId, tx);
    }
    return tx.recordChangeRequest.update({
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
  if (!request) return { ok: false, message: "errors.alreadyDecided" };

  await audit(
    admin.id,
    approved ? "record_request.approved" : "record_request.rejected",
    { type: "User", id: request.userId },
    {
      requestId: id,
      role: request.role,
      proposed: request.proposed,
      note: note || null,
    },
  );
  await notify(request.user, {
    kind: approved ? "RECORD_REQUEST_APPROVED" : "RECORD_REQUEST_REJECTED",
    refId: id,
    path: "/app/profile/record",
    note: note || null,
  }).catch((e) => console.error("[record-requests] member notify failed", e));

  refresh();
  return {
    ok: true,
    message: approved ? "decided.approved" : "decided.rejected",
  };
}
