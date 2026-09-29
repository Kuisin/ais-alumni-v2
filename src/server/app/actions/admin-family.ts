// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { AccountState } from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import {
  CHILD_ROLES,
  confirmLinkInTx,
  PARENT_ROLES,
} from "@/server/lib/family";
import { adminLinkFamily, regroupFamily } from "@/server/lib/family-admin";
import { otherNames } from "@/server/lib/format";
import { toKatakana } from "@/server/lib/names";
import { actionAdmin } from "@/server/lib/session";
import { syncMemberStatus } from "@/server/lib/status-sync";

/**
 * Admin: edit a member's family (管理 → 会員 → 家族). Links the admin makes
 * or confirms are confirmed at once; removing a confirmed link splits the
 * family along the links that remain. Parent / student statuses and group
 * chats follow (syncMemberStatus).
 */

export type FamilyCandidate = {
  id: string;
  name: string;
  other: string | null;
};
export type AdminFamilyResult = { ok: boolean; message?: string };

const isId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 64;

/** Members who could be this member's parent or child (by name). */
export async function searchFamilyCandidatesAction(
  memberId: string,
  as: "parent" | "child",
  q: string,
): Promise<FamilyCandidate[]> {
  const admin = await actionAdmin().catch(() => null);
  const term = String(q ?? "")
    .trim()
    .slice(0, 60);
  if (!admin || !term || !isId(memberId)) return [];
  const rows = await db.user.findMany({
    where: {
      id: { not: memberId },
      state: { not: AccountState.DEACTIVATED },
      roles: {
        some: {
          role: { in: [...(as === "parent" ? PARENT_ROLES : CHILD_ROLES)] },
        },
      },
      OR: [
        { nameRomaji: { contains: term, mode: "insensitive" } },
        { nameKanji: { contains: term } },
        { nameKana: { contains: toKatakana(term) } },
      ],
    },
    orderBy: { nameRomaji: "asc" },
    take: 10,
    select: { id: true, nameRomaji: true, nameKanji: true, nameKana: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.nameRomaji ?? r.nameKanji ?? "—",
    other: otherNames(r),
  }));
}

async function afterChange(ids: string[]) {
  for (const id of ids)
    await syncMemberStatus(id).catch((e) =>
      console.error("[admin-family] status sync failed", e),
    );
  refresh();
}

/** Link the member to a parent or a child (confirmed). */
export async function addFamilyLinkAction(
  memberId: string,
  otherId: string,
  as: "parent" | "child",
): Promise<AdminFamilyResult> {
  const admin = await actionAdmin().catch(() => null);
  if (!admin || !isId(memberId) || !isId(otherId))
    return { ok: false, message: "errors.forbidden" };
  // `as` is the other person's role: "parent" = they are the member's parent.
  const parentId = as === "parent" ? otherId : memberId;
  const childId = as === "parent" ? memberId : otherId;
  const res = await db.$transaction((tx) =>
    adminLinkFamily(tx, parentId, childId),
  );
  if (!res.ok) return { ok: false, message: `family.errors.${res.error}` };
  await audit(
    admin.id,
    "family.linked",
    { type: "User", id: memberId },
    {
      parentId,
      childId,
    },
  );
  await afterChange([parentId, childId]);
  return { ok: true, message: "family.linked" };
}

/** Confirm a pending link (both people have accounts). */
export async function confirmFamilyLinkAdminAction(
  linkId: string,
): Promise<AdminFamilyResult> {
  const admin = await actionAdmin().catch(() => null);
  if (!admin || !isId(linkId))
    return { ok: false, message: "errors.forbidden" };
  const link = await db.familyLink.findUnique({ where: { id: linkId } });
  if (!link || link.confirmedAt || !link.childId)
    return { ok: false, message: "family.errors.notFound" };
  await db.$transaction((tx) => confirmLinkInTx(tx, link, "ADMIN"));
  await audit(
    admin.id,
    "family.confirmed",
    { type: "User", id: link.parentId },
    {
      linkId,
      childId: link.childId,
    },
  );
  await afterChange([link.parentId, link.childId]);
  return { ok: true, message: "family.confirmed" };
}

/** Remove a link; a confirmed one may split the family. */
export async function removeFamilyLinkAdminAction(
  linkId: string,
): Promise<AdminFamilyResult> {
  const admin = await actionAdmin().catch(() => null);
  if (!admin || !isId(linkId))
    return { ok: false, message: "errors.forbidden" };
  const link = await db.familyLink.findUnique({ where: { id: linkId } });
  if (!link) return { ok: false, message: "family.errors.notFound" };
  await db.$transaction(async (tx) => {
    await tx.familyLink.delete({ where: { id: linkId } });
    if (link.confirmedAt) await regroupFamily(tx, link.familyId);
  });
  await audit(
    admin.id,
    "family.unlinked",
    { type: "User", id: link.parentId },
    {
      linkId,
      childId: link.childId,
      childName: link.childName,
      wasConfirmed: Boolean(link.confirmedAt),
    },
  );
  await afterChange([link.parentId, ...(link.childId ? [link.childId] : [])]);
  return { ok: true, message: "family.removed" };
}
