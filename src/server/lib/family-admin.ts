import type { Prisma } from "@/server/generated/prisma/client";
import { FamilyLinkInitiator } from "@/server/generated/prisma/enums";
import {
  CHILD_ROLES,
  confirmLinkInTx,
  hasAnyRole,
  PARENT_ROLES,
} from "./family";

type Tx = Prisma.TransactionClient;

/**
 * Group members into families by confirmed links (pure): each connected
 * group of parents and children is one family. Members without a confirmed
 * link are alone.
 */
export function familyGroups(
  memberIds: readonly string[],
  links: readonly { parentId: string; childId: string | null }[],
): string[][] {
  const parent = new Map(memberIds.map((id) => [id, id]));
  const find = (id: string): string => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r) as string;
    parent.set(id, r);
    return r;
  };
  for (const l of links) {
    if (!l.childId || !parent.has(l.parentId) || !parent.has(l.childId))
      continue;
    parent.set(find(l.childId), find(l.parentId));
  }
  const groups = new Map<string, string[]>();
  for (const id of memberIds) {
    const r = find(id);
    groups.set(r, [...(groups.get(r) ?? []), id]);
  }
  // Largest first: it keeps the existing family.
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/**
 * After a confirmed link is removed, split the family along its remaining
 * confirmed links: the largest group keeps the family; other groups get a
 * new one (or none when alone without pending links). Links follow their
 * parent's group.
 */
export async function regroupFamily(tx: Tx, familyId: string): Promise<void> {
  const [members, links] = await Promise.all([
    tx.user.findMany({ where: { familyId }, select: { id: true } }),
    tx.familyLink.findMany({
      where: { familyId },
      select: { id: true, parentId: true, childId: true, confirmedAt: true },
    }),
  ]);
  const groups = familyGroups(
    members.map((m) => m.id),
    links.filter((l) => l.confirmedAt),
  );
  const [, ...others] = groups;
  for (const group of others) {
    const ids = new Set(group);
    const own = links.filter((l) => ids.has(l.parentId));
    const touches = links.some(
      (l) => ids.has(l.parentId) || (l.childId && ids.has(l.childId)),
    );
    if (group.length === 1 && !touches) {
      await tx.user.update({
        where: { id: group[0] },
        data: { familyId: null },
      });
      continue;
    }
    const fresh = await tx.family.create({ data: {} });
    await tx.user.updateMany({
      where: { id: { in: group } },
      data: { familyId: fresh.id },
    });
    if (own.length)
      await tx.familyLink.updateMany({
        where: { id: { in: own.map((l) => l.id) } },
        data: { familyId: fresh.id },
      });
  }
  // A family nobody is left in goes too (its links cascade).
  const left = await tx.user.count({ where: { familyId } });
  const linksLeft = await tx.familyLink.count({ where: { familyId } });
  if (!left && !linksLeft) await tx.family.delete({ where: { id: familyId } });
}

export type AdminLinkError = "self" | "wrongRole" | "already" | "notFound";

/** Admin: link a parent and a child, confirmed straight away. */
export async function adminLinkFamily(
  tx: Tx,
  parentId: string,
  childId: string,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; error: AdminLinkError }> {
  if (parentId === childId) return { ok: false, error: "self" };
  const users = await tx.user.findMany({
    where: { id: { in: [parentId, childId] } },
    select: { id: true, familyId: true, roles: { select: { role: true } } },
  });
  const p = users.find((u) => u.id === parentId);
  const c = users.find((u) => u.id === childId);
  if (!p || !c) return { ok: false, error: "notFound" };
  if (
    !hasAnyRole(
      p.roles.map((r) => r.role),
      PARENT_ROLES,
    ) ||
    !hasAnyRole(
      c.roles.map((r) => r.role),
      CHILD_ROLES,
    )
  )
    return { ok: false, error: "wrongRole" };
  const existing = await tx.familyLink.findFirst({
    where: { parentId, childId },
  });
  if (existing?.confirmedAt) return { ok: false, error: "already" };
  let familyId: string | null = p.familyId ?? c.familyId;
  if (!familyId) {
    familyId = (await tx.family.create({ data: {} })).id;
    await tx.user.update({ where: { id: parentId }, data: { familyId } });
  }
  const link =
    existing ??
    (await tx.familyLink.create({
      data: {
        familyId,
        parentId,
        childId,
        initiatedBy: FamilyLinkInitiator.PARENT,
      },
    }));
  await confirmLinkInTx(tx, link, "ADMIN", now);
  return { ok: true };
}
