import type { Prisma } from "@/server/generated/prisma/client";
import { db } from "@/server/lib/db";
import {
  cleanOrgName,
  type OrgKind,
  type OrgOption,
  orgNameKey,
} from "@/server/lib/organizations";

type Client = Prisma.TransactionClient | typeof db;

/** Existing schools / companies matching the query, most used first. */
export async function searchOrgs(
  kind: OrgKind,
  q: string,
  limit = 8,
): Promise<OrgOption[]> {
  const key = orgNameKey(q);
  if (!key) return [];
  const where = {
    OR: [
      { name: { contains: cleanOrgName(q), mode: "insensitive" as const } },
      { nameKey: { contains: key } },
    ],
  };
  const rows =
    kind === "school"
      ? await db.school.findMany({
          where,
          include: { _count: { select: { entries: true } } },
          take: 50,
        })
      : await db.company.findMany({
          where,
          include: { _count: { select: { entries: true } } },
          take: 50,
        });
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      count: r._count.entries,
      starts: r.nameKey.startsWith(key),
    }))
    .sort(
      (a, b) =>
        Number(b.starts) - Number(a.starts) ||
        b.count - a.count ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map(({ starts: _s, ...o }) => o);
}

/**
 * The id for a picked organization: an existing id, or the name typed —
 * reusing a matching entry (same nameKey) before creating a new one.
 */
export async function resolveOrg(
  kind: OrgKind,
  input: { id?: string | null; name?: string | null },
  createdById: string,
  client: Client = db,
): Promise<string | null> {
  if (input.id) {
    const row =
      kind === "school"
        ? await client.school.findUnique({
            where: { id: input.id },
            select: { id: true },
          })
        : await client.company.findUnique({
            where: { id: input.id },
            select: { id: true },
          });
    if (row) return row.id;
  }
  const name = cleanOrgName(input.name ?? "");
  if (!name) return null;
  const data = { name, nameKey: orgNameKey(name), createdById };
  const row =
    kind === "school"
      ? await client.school.upsert({
          where: { nameKey: data.nameKey },
          update: {},
          create: data,
          select: { id: true },
        })
      : await client.company.upsert({
          where: { nameKey: data.nameKey },
          update: {},
          create: data,
          select: { id: true },
        });
  return row.id;
}
