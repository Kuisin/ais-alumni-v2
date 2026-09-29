// From the website's server actions; here plain functions the API calls.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DirectChatRule, type RoleKey } from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import {
  CHAT_REPORT_LIMITS,
  isChatReportReason,
} from "@/server/lib/chat-report";
import {
  chatReportRateLimited,
  createChatReport,
} from "@/server/lib/chat-report-db";
import { db } from "@/server/lib/db";
import { DIRECT_RULE_ROLES } from "@/server/lib/direct-policy";
import { actionActive, actionAdmin } from "@/server/lib/session";

const Id = z.string().min(1).max(64);

export type ChatReportFormState = {
  ok?: boolean;
  ref?: string;
  /** chat.report.errors.<key> */
  error?: "forbidden" | "reason" | "detail" | "rateLimited";
} | null;

/**
 * A member reports a chat they're in, or someone in it, to the admins.
 * Only members of the chat, and only about other members of it.
 */
export async function reportChatAction(
  _prev: ChatReportFormState,
  fd: FormData,
): Promise<ChatReportFormState> {
  const user = await actionActive().catch(() => null);
  const groupId = Id.safeParse(fd.get("groupId"));
  if (!user || !groupId.success) return { error: "forbidden" };
  const member = await db.chatMember.findUnique({
    where: { groupId_userId: { groupId: groupId.data, userId: user.id } },
    select: { groupId: true },
  });
  if (!member) return { error: "forbidden" };

  const reason = String(fd.get("reason") ?? "");
  if (!isChatReportReason(reason)) return { error: "reason" };
  const detail = String(fd.get("detail") ?? "").trim();
  if (detail.length < 5 || detail.length > CHAT_REPORT_LIMITS.detail)
    return { error: "detail" };

  const rawUser = String(fd.get("userId") ?? "");
  let reportedUserId: string | null = null;
  if (rawUser) {
    const other = Id.safeParse(rawUser);
    if (!other.success || other.data === user.id) return { error: "forbidden" };
    const inChat = await db.chatMember.findUnique({
      where: {
        groupId_userId: { groupId: groupId.data, userId: other.data },
      },
      select: { userId: true },
    });
    if (!inChat) return { error: "forbidden" };
    reportedUserId = other.data;
  }

  if (await chatReportRateLimited(user.id)) return { error: "rateLimited" };
  const { ref } = await createChatReport({
    groupId: groupId.data,
    reporterId: user.id,
    reportedUserId,
    reason,
    detail,
  });
  revalidatePath("/[locale]/app/admin/chat", "page");
  return { ok: true, ref };
}

/** Admin: mark a report handled, or open it again. */
export async function setChatReportClosedAction(fd: FormData): Promise<void> {
  const me = await actionAdmin();
  const id = Id.parse(fd.get("id"));
  const close = fd.get("close") === "1";
  await db.chatReport.update({
    where: { id },
    data: close
      ? { closedAt: new Date(), closedById: me.id }
      : { closedAt: null, closedById: null },
    select: { id: true },
  });
  await audit(me.id, close ? "chat.report_close" : "chat.report_reopen", {
    type: "ChatReport",
    id,
  });
  revalidatePath("/[locale]/app/admin/chat", "page");
}

export type DirectRulesFormState = { ok?: boolean; error?: boolean } | null;

const RuleSchema = z.enum(DirectChatRule);

/** Admin: who each member type may have 1:1 talks with. */
export async function saveDirectRulesAction(
  _prev: DirectRulesFormState,
  fd: FormData,
): Promise<DirectRulesFormState> {
  const me = await actionAdmin();
  const rules: { role: RoleKey; rule: DirectChatRule }[] = [];
  for (const role of DIRECT_RULE_ROLES) {
    const rule = RuleSchema.safeParse(fd.get(`rule.${role}`));
    if (!rule.success) return { error: true };
    rules.push({ role, rule: rule.data });
  }
  const before = await db.directChatPolicy.findMany({
    select: { role: true, rule: true },
  });
  await db.$transaction(
    rules.map((r) =>
      db.directChatPolicy.upsert({
        where: { role: r.role },
        create: { ...r, updatedById: me.id },
        update: { rule: r.rule, updatedById: me.id },
      }),
    ),
  );
  await audit(me.id, "chat.direct_rules", undefined, {
    before: Object.fromEntries(before.map((r) => [r.role, r.rule])),
    after: Object.fromEntries(rules.map((r) => [r.role, r.rule])),
  });
  revalidatePath("/[locale]/app", "layout");
  return { ok: true };
}
