import type { AdminAudit, AuditEntry } from "@contract/admin-manage";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@/server/generated/prisma/client";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";

const PAGE_SIZE = 50;

/** Action prefixes offered in the audit filter (values match `action`). */
export const AUDIT_CATEGORIES = [
  "member",
  "verification",
  "teacher",
  "record_request",
  "event",
  "news",
  "broadcast",
  "cohort",
  "roster",
  "school",
  "company",
  "self",
  "user",
  "donation",
  "line",
] as const;

export const AUDIT_ROW_INCLUDE = {
  actor: {
    select: { id: true, nameRomaji: true, nameKanji: true, primaryEmail: true },
  },
} as const;

export type AuditRow = Prisma.AuditLogGetPayload<{
  include: typeof AUDIT_ROW_INCLUDE;
}>;

type Person = {
  nameRomaji: string | null;
  nameKanji: string | null;
  primaryEmail: string | null;
};

/** Admin-facing page for a target, when there is one (website path). */
function targetPath(type: string | null, id: string): string | null {
  switch (type) {
    case "User":
      return `/app/admin/members/${id}`;
    case "VerificationRequest":
      return `/app/admin/verification/${id}`;
    case "Event":
      return `/app/admin/events/${id}`;
    case "NewsPost":
      return `/app/admin/news/${id}`;
    default:
      return null;
  }
}

const dataUserId = (r: AuditRow) =>
  r.data && typeof r.data === "object" && !Array.isArray(r.data)
    ? typeof r.data.userId === "string"
      ? r.data.userId
      : null
    : null;

/**
 * Audit rows as the website's AuditList shows them: human action label,
 * actor, target (members resolved to names; the applicant behind a
 * verification request), data as JSON. Also for a member's own log.
 */
export async function presentAuditRows(
  rows: AuditRow[],
  locale: "ja" | "en",
): Promise<AuditEntry[]> {
  const ta = await getTranslations("audit");
  const userIds = new Set<string>();
  for (const r of rows) {
    if (r.targetType === "User" && r.targetId) userIds.add(r.targetId);
    const uid = dataUserId(r);
    if (uid) userIds.add(uid);
  }
  const people = new Map<string, Person>(
    userIds.size
      ? (
          await db.user.findMany({
            where: { id: { in: [...userIds] } },
            select: {
              id: true,
              nameRomaji: true,
              nameKanji: true,
              primaryEmail: true,
            },
          })
        ).map((u) => [u.id, u])
      : [],
  );
  const personLabel = (p: Person, id: string) =>
    p.nameRomaji || p.nameKanji
      ? displayName(p, locale)
      : (p.primaryEmail ?? id);
  const actionLabel = (action: string): string | null => {
    const key = `actions.${action}`;
    return ta.has(key) && typeof ta.raw(key) === "string" ? ta(key) : null;
  };
  const typeLabel = (type: string): string =>
    ta.has(`targetTypes.${type}`) ? ta(`targetTypes.${type}`) : type;

  return rows.map((r) => {
    const hasData =
      r.data !== null &&
      !(typeof r.data === "object" && Object.keys(r.data ?? {}).length === 0);
    const targetPerson =
      r.targetType === "User" && r.targetId
        ? people.get(r.targetId)
        : undefined;
    const applicantId =
      r.targetType === "VerificationRequest" ? dataUserId(r) : null;
    const applicant = applicantId ? people.get(applicantId) : null;
    return {
      id: r.id,
      action: r.action,
      label: actionLabel(r.action),
      createdAt: r.createdAt.toISOString(),
      data: hasData ? JSON.stringify(r.data, null, 2) : null,
      actor: r.actor
        ? {
            id: r.actor.id,
            label:
              r.actor.nameRomaji || r.actor.nameKanji
                ? displayName(r.actor, locale)
                : (r.actor.primaryEmail ?? r.actor.id),
          }
        : null,
      target: r.targetId
        ? {
            id: r.targetId,
            type: r.targetType,
            typeLabel: r.targetType ? typeLabel(r.targetType) : null,
            path: targetPath(r.targetType, r.targetId),
            person: targetPerson ? personLabel(targetPerson, r.targetId) : null,
          }
        : null,
      applicant:
        applicant && applicantId
          ? { id: applicantId, label: personLabel(applicant, applicantId) }
          : null,
    };
  });
}

/** 監査ログ (the website's /app/admin/audit; the caller checks admin). */
export async function loadAdminAudit(
  locale: "ja" | "en",
  sp: Record<string, string>,
): Promise<AdminAudit> {
  const action = (sp.action ?? "").trim().slice(0, 100);
  const target = (sp.target ?? "").trim().slice(0, 100);
  const cursor = (sp.cursor ?? "").trim() || null;
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
    ...(target ? { OR: [{ targetId: target }, { actorId: target }] } : {}),
  };
  const rows = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: AUDIT_ROW_INCLUDE,
  });
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  return {
    entries: await presentAuditRows(page, locale),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}
