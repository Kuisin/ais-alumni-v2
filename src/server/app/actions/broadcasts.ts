// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { z } from "zod";
import { AudienceKey } from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import {
  type BroadcastPreview,
  getBroadcastRights,
  previewBroadcast,
  sendBroadcast,
} from "@/server/lib/broadcasts";
import { db } from "@/server/lib/db";
import { MESSAGES_ENABLED } from "@/server/lib/features";
import { type Audience, rightFor, withinLimit } from "@/server/lib/permissions";
import { AuthError, actionActive } from "@/server/lib/session";

export type BroadcastFormState = {
  step: "compose" | "confirm" | "sent";
  /** key in the "broadcast" namespace */
  message?: string;
  fieldErrors?: Partial<
    Record<"title" | "body" | "audience" | "cohortId", string>
  >;
  preview?: BroadcastPreview;
} | null;

const formSchema = z
  .object({
    audience: z.enum(["ALL", "ROLES", "COHORT"]),
    roles: z.array(z.enum(AudienceKey)),
    cohortId: z.string().trim(),
    title: z.string().trim().min(1, "required").max(100, "tooLong"),
    body: z.string().trim().min(1, "required").max(2000, "tooLong"),
  })
  .superRefine((v, ctx) => {
    if (v.audience === "ROLES" && v.roles.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["audience"],
        message: "rolesRequired",
      });
    if (v.audience === "COHORT" && !v.cohortId)
      ctx.addIssue({
        code: "custom",
        path: ["cohortId"],
        message: "cohortRequired",
      });
  });

function toAudience(v: z.infer<typeof formSchema>): Audience {
  if (v.audience === "COHORT") return { scope: "COHORT", cohortId: v.cohortId };
  return { scope: "ALL", audiences: v.audience === "ROLES" ? v.roles : [] };
}

/**
 * Two-step send: intent=preview shows recipient and LINE counts; intent=send
 * delivers. Permissions and limits are checked on both steps.
 */
export async function broadcastAction(
  _prev: BroadcastFormState,
  fd: FormData,
): Promise<BroadcastFormState> {
  if (!MESSAGES_ENABLED)
    return { step: "compose", message: "errors.forbidden" };
  let me: Awaited<ReturnType<typeof actionActive>>;
  try {
    me = await actionActive();
  } catch (e) {
    if (e instanceof AuthError)
      return { step: "compose", message: "errors.forbidden" };
    throw e;
  }
  const intent = fd.get("intent");
  if (intent === "edit") return { step: "compose" };

  const parsed = formSchema.safeParse({
    audience: fd.get("audience"),
    roles: fd.getAll("roles"),
    cohortId: String(fd.get("cohortId") ?? ""),
    title: String(fd.get("title") ?? ""),
    body: String(fd.get("body") ?? ""),
  });
  if (!parsed.success) {
    return {
      step: "compose",
      message: "errors.validation",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }
  const audience = toAudience(parsed.data);
  const right = rightFor(await getBroadcastRights(me), audience);
  if (!right) return { step: "compose", message: "errors.notAllowed" };

  const recent = await db.broadcast.findMany({
    where: {
      senderId: me.id,
      createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
    },
    select: { createdAt: true },
  });
  if (
    !withinLimit(
      right.position,
      recent.map((r) => r.createdAt),
    )
  ) {
    return { step: "compose", message: "errors.limit" };
  }

  if (intent !== "send") {
    const preview = await previewBroadcast(me.id, audience);
    if (preview.recipients === 0)
      return { step: "compose", message: "errors.noRecipients" };
    return { step: "confirm", preview };
  }
  const result = await sendBroadcast({
    sender: me,
    right,
    audience,
    title: parsed.data.title,
    body: parsed.data.body,
  });
  refresh();
  return { step: "sent", preview: result, message: "sent" };
}

// ---------------------------------------------------------------------------
// Managing a sent message: its sender or an admin may edit, archive or delete.

export type ManageMessageState = {
  ok: boolean;
  /** key in the "broadcast" namespace */
  message: string;
  fieldErrors?: Partial<Record<"title" | "body", string>>;
} | null;

async function manageable(id: string) {
  const me = await actionActive();
  const b = await db.broadcast.findUnique({
    where: { id },
    select: { id: true, senderId: true },
  });
  if (!b || (b.senderId !== me.id && !me.isAdmin)) return null;
  return { me, b };
}

const editSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1, "required").max(100, "tooLong"),
  body: z.string().trim().min(1, "required").max(2000, "tooLong"),
});

/** Edit the title/body in place. Recipients see 「編集済み」; no new notification. */
export async function editBroadcastAction(
  _prev: ManageMessageState,
  fd: FormData,
): Promise<ManageMessageState> {
  const parsed = editSchema.safeParse({
    id: fd.get("id"),
    title: fd.get("title"),
    body: fd.get("body"),
  });
  if (!parsed.success) {
    const fieldErrors: NonNullable<ManageMessageState>["fieldErrors"] = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0]);
      if (k === "title" || k === "body") fieldErrors[k] ??= i.message;
    }
    return { ok: false, message: "manage.errors.invalid", fieldErrors };
  }
  let ctx: Awaited<ReturnType<typeof manageable>>;
  try {
    ctx = await manageable(parsed.data.id);
  } catch (e) {
    if (e instanceof AuthError)
      return { ok: false, message: "manage.errors.forbidden" };
    throw e;
  }
  if (!ctx) return { ok: false, message: "manage.errors.forbidden" };
  await db.broadcast.update({
    where: { id: ctx.b.id },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      editedAt: new Date(),
    },
  });
  await audit(ctx.me.id, "broadcast.edited", {
    type: "Broadcast",
    id: ctx.b.id,
  });
  refresh();
  return { ok: true, message: "manage.saved" };
}

/**
 * Archive (hide from recipients) or restore. False when the member may not
 * manage it (the website's form then does nothing).
 */
export async function setBroadcastArchivedAction(
  fd: FormData,
): Promise<boolean> {
  const id = z.string().min(1).max(64).parse(fd.get("id"));
  const archive = fd.get("archive") === "1";
  const ctx = await manageable(id);
  if (!ctx) return false;
  await db.broadcast.update({
    where: { id },
    data: { archivedAt: archive ? new Date() : null },
  });
  await audit(
    ctx.me.id,
    archive ? "broadcast.archived" : "broadcast.restored",
    { type: "Broadcast", id },
  );
  refresh();
  return true;
}

/**
 * Delete permanently, with its read receipts. False when the member may not
 * manage it; the website then went back to the send page, the app does.
 */
export async function deleteBroadcastAction(fd: FormData): Promise<boolean> {
  const id = z.string().min(1).max(64).parse(fd.get("id"));
  const ctx = await manageable(id);
  if (!ctx) return false;
  const b = await db.broadcast.delete({
    where: { id },
    select: { title: true, recipientCount: true },
  });
  await audit(
    ctx.me.id,
    "broadcast.deleted",
    { type: "Broadcast", id },
    {
      title: b.title,
      recipients: b.recipientCount,
    },
  );
  return true;
}
