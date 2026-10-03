import { webPathFor } from "@/lib/site-paths";
import { getTranslatorFor } from "@/server/i18n/translator";
import {
  CHAT_REPORT_LIMITS,
  type ChatReportMessage,
  type ChatReportReason,
} from "@/server/lib/chat-report";
import { db } from "@/server/lib/db";
import { sendEmail } from "@/server/lib/email";
import { displayName } from "@/server/lib/format";
import { supportRef } from "@/server/lib/support";
import { adminInboxes } from "@/server/lib/support-db";
import { publicUrl } from "@/server/lib/urls";

/** Too many reports from this member in the last hour? */
export async function chatReportRateLimited(userId: string): Promise<boolean> {
  const n = await db.chatReport.count({
    where: {
      reporterId: userId,
      createdAt: { gt: new Date(Date.now() - 3_600_000) },
    },
  });
  return n >= CHAT_REPORT_LIMITS.perHour;
}

/**
 * Save a report and email the admins (no message content in the email;
 * they read it in admin → チャット). Recent messages from the reported
 * member (or from the chat, if nobody is named) are attached, since admins
 * can't open 1:1 talks.
 */
export async function createChatReport(input: {
  groupId: string;
  reporterId: string;
  reportedUserId: string | null;
  reason: ChatReportReason;
  detail: string;
}): Promise<{ id: string; ref: string }> {
  const recent = await db.chatMessage.findMany({
    where: {
      groupId: input.groupId,
      deletedAt: null,
      ...(input.reportedUserId ? { userId: input.reportedUserId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: CHAT_REPORT_LIMITS.snapshot,
    select: {
      id: true,
      userId: true,
      body: true,
      createdAt: true,
      user: { select: { nameRomaji: true, nameKanji: true } },
    },
  });
  const messages: ChatReportMessage[] = recent.reverse().map((m) => ({
    id: m.id,
    userId: m.userId,
    name: displayName(m.user),
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));
  const report = await db.chatReport.create({
    data: { ...input, messages },
    select: { id: true },
  });
  const ref = supportRef(report.id);

  const sends = (await adminInboxes()).map(async (a) => {
    const t = await getTranslatorFor(a.locale, "chat");
    await sendEmail({
      to: a.primaryEmail,
      subject: t("report.email.subject", {
        ref,
        reason: t(`report.reasons.${input.reason}`),
      }),
      text: t("report.email.text"),
      url: publicUrl(webPathFor(`/app/admin/chat#${report.id}`)),
    });
  });
  for (const r of await Promise.allSettled(sends))
    if (r.status === "rejected")
      console.error("[chat-report] email failed", r.reason);
  return { id: report.id, ref };
}
