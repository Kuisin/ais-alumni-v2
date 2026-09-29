import type {
  AdminChat,
  AdminSupport,
  AuditPerson,
} from "@contract/admin-manage";
import { getTranslations } from "next-intl/server";
import { ChatGroupKind } from "@/server/generated/prisma/enums";
import { GROUP_SELECT, loadDirectRules } from "@/server/lib/chat-db";
import { chatGroupName } from "@/server/lib/chat-labels";
import type { ChatReportMessage } from "@/server/lib/chat-report";
import { db } from "@/server/lib/db";
import { DIRECT_RULE_ROLES } from "@/server/lib/direct-policy";
import { displayName } from "@/server/lib/format";
import { supportRef } from "@/server/lib/support";

const NAME = { id: true, nameRomaji: true, nameKanji: true } as const;

type NameRow = {
  id: string;
  nameRomaji: string | null;
  nameKanji: string | null;
};

const person = (u: NameRow | null, locale: "ja" | "en"): AuditPerson | null =>
  u ? { id: u.id, label: displayName(u, locale) } : null;

/**
 * お問い合わせ inbox (the website's /app/admin/support; the caller checks
 * admin): open requests first (oldest first), closed ones newest first.
 */
export async function loadAdminSupport(
  locale: "ja" | "en",
  tabParam: string | undefined,
): Promise<AdminSupport> {
  const tab = tabParam === "closed" ? "closed" : "open";
  const where =
    tab === "open" ? { closedAt: null } : { closedAt: { not: null } };
  const [rows, open, closed] = await Promise.all([
    db.supportRequest.findMany({
      where,
      orderBy: { createdAt: tab === "open" ? "asc" : "desc" },
      take: 200,
      include: { user: { select: NAME } },
    }),
    db.supportRequest.count({ where: { closedAt: null } }),
    db.supportRequest.count({ where: { closedAt: { not: null } } }),
  ]);
  return {
    tab,
    counts: { open, closed },
    requests: rows.map((r) => ({
      id: r.id,
      ref: supportRef(r.id),
      type: r.type,
      topic: r.topic,
      subject: r.subject,
      message: r.message,
      name: r.name,
      email: r.email,
      member: person(r.user, locale),
      page: r.page,
      locale: r.locale === "en" ? "en" : "ja",
      createdAt: r.createdAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
    })),
  };
}

/**
 * Chat moderation (the website's /app/admin/chat; the caller checks admin):
 * the 1:1 talk rules and the members' reports.
 */
export async function loadAdminChat(
  locale: "ja" | "en",
  tabParam: string | undefined,
): Promise<AdminChat> {
  const tab = tabParam === "closed" ? "closed" : "open";
  const tc = await getTranslations("chat");
  const where =
    tab === "open" ? { closedAt: null } : { closedAt: { not: null } };
  const [rules, rows, open, closed] = await Promise.all([
    loadDirectRules(),
    db.chatReport.findMany({
      where,
      orderBy: { createdAt: tab === "open" ? "asc" : "desc" },
      take: 200,
      include: {
        reporter: { select: NAME },
        reportedUser: { select: NAME },
        group: { select: GROUP_SELECT },
      },
    }),
    db.chatReport.count({ where: { closedAt: null } }),
    db.chatReport.count({ where: { closedAt: { not: null } } }),
  ]);
  return {
    rules: Object.fromEntries(DIRECT_RULE_ROLES.map((r) => [r, rules[r]])),
    ruleRoles: [...DIRECT_RULE_ROLES],
    tab,
    counts: { open, closed },
    reports: rows.map((r) => {
      const messages = (r.messages ?? []) as ChatReportMessage[];
      const direct = r.group?.kind === ChatGroupKind.DIRECT;
      return {
        id: r.id,
        ref: supportRef(r.id),
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        closedAt: r.closedAt?.toISOString() ?? null,
        chat: r.group
          ? {
              id: r.group.id,
              direct,
              // Admins can't open 1:1 talks: the attached messages are
              // what they can see.
              name: direct
                ? tc("room.direct")
                : chatGroupName(tc, r.group, locale),
            }
          : null,
        reporter: person(r.reporter, locale),
        reported: person(r.reportedUser, locale),
        wholeChat: !r.reportedUserId,
        detail: r.detail,
        messages: messages.map((m) => ({
          id: m.id,
          name: m.name,
          body: m.body,
          createdAt: m.createdAt,
        })),
      };
    }),
  };
}
