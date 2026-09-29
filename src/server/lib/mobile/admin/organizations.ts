import type { AdminOrgs } from "@contract/admin-manage";
import { db } from "@/server/lib/db";
import {
  cleanOrgName,
  type OrgKind,
  orgNameKey,
} from "@/server/lib/organizations";

const LIMIT = 200;

/**
 * Schools and companies used in 学歴 / 職歴 (the website's
 * /app/admin/organizations; the caller checks admin).
 */
export async function loadAdminOrgs(params: {
  kind?: string;
  sort?: string;
  q?: string;
}): Promise<AdminOrgs> {
  const kind: OrgKind = params.kind === "company" ? "company" : "school";
  const sort = params.sort === "count" ? "count" : "name";
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const key = orgNameKey(q);
  const where = key
    ? {
        OR: [
          { name: { contains: cleanOrgName(q), mode: "insensitive" as const } },
          { nameKey: { contains: key } },
        ],
      }
    : {};
  // Sorting by 人数 brings the entries that matter (and their duplicates) up.
  const orderBy =
    sort === "count"
      ? [{ entries: { _count: "desc" as const } }, { name: "asc" as const }]
      : [{ name: "asc" as const }];
  const [rows, total, school, company] = await Promise.all([
    (kind === "school"
      ? db.school.findMany({
          where,
          include: { _count: { select: { entries: true } } },
          orderBy,
          take: LIMIT,
        })
      : db.company.findMany({
          where,
          include: { _count: { select: { entries: true } } },
          orderBy,
          take: LIMIT,
        })
    ).then((list) =>
      list.map((r) => ({ id: r.id, name: r.name, count: r._count.entries })),
    ),
    kind === "school"
      ? db.school.count({ where })
      : db.company.count({ where }),
    db.school.count(),
    db.company.count(),
  ]);
  return { kind, sort, q, rows, total, counts: { school, company } };
}
