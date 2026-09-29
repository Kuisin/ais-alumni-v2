// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import {
  cleanOrgName,
  type OrgKind,
  orgNameKey,
} from "@/server/lib/organizations";
import { AuthError, actionAdmin } from "@/server/lib/session";

/** message = key in the "organizations" namespace */
export type OrgAdminState = { ok?: boolean; message?: string } | null;

const kindOf = (v: FormDataEntryValue | null): OrgKind | null =>
  v === "school" || v === "company" ? v : null;

async function admin() {
  try {
    return await actionAdmin();
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

/** Rename; if the new name matches another entry, suggest merging instead. */
export async function renameOrgAction(
  _prev: OrgAdminState,
  fd: FormData,
): Promise<OrgAdminState> {
  const me = await admin();
  if (!me) return { ok: false, message: "errors.forbidden" };
  const kind = kindOf(fd.get("kind"));
  const id = String(fd.get("id") ?? "");
  const name = cleanOrgName(String(fd.get("name") ?? ""));
  if (!kind || !id || !name || name.length > 120)
    return { ok: false, message: "errors.invalid" };
  const nameKey = orgNameKey(name);
  const clash =
    kind === "school"
      ? await db.school.findUnique({ where: { nameKey }, select: { id: true } })
      : await db.company.findUnique({
          where: { nameKey },
          select: { id: true },
        });
  if (clash && clash.id !== id) return { ok: false, message: "errors.exists" };
  if (kind === "school")
    await db.school.update({ where: { id }, data: { name, nameKey } });
  else await db.company.update({ where: { id }, data: { name, nameKey } });
  await audit(me.id, `${kind}.renamed`, { type: kind, id }, { name });
  refresh();
  return { ok: true, message: "renamed" };
}

/** Merge a duplicate into another entry: its members move, it is deleted. */
export async function mergeOrgAction(
  _prev: OrgAdminState,
  fd: FormData,
): Promise<OrgAdminState> {
  const me = await admin();
  if (!me) return { ok: false, message: "errors.forbidden" };
  const kind = kindOf(fd.get("kind"));
  const fromId = String(fd.get("id") ?? "");
  const toId = String(fd.get(`${kind}Id`) ?? "");
  if (!kind || !fromId) return { ok: false, message: "errors.invalid" };
  if (!toId) return { ok: false, message: "errors.pickTarget" };
  if (toId === fromId) return { ok: false, message: "errors.sameTarget" };
  await db.$transaction(async (tx) => {
    if (kind === "school") {
      await tx.school.findUniqueOrThrow({ where: { id: toId } });
      await tx.educationEntry.updateMany({
        where: { schoolId: fromId },
        data: { schoolId: toId },
      });
      await tx.school.delete({ where: { id: fromId } });
    } else {
      await tx.company.findUniqueOrThrow({ where: { id: toId } });
      await tx.workEntry.updateMany({
        where: { companyId: fromId },
        data: { companyId: toId },
      });
      await tx.company.delete({ where: { id: fromId } });
    }
  });
  await audit(
    me.id,
    `${kind}.merged`,
    { type: kind, id: toId },
    { from: fromId },
  );
  refresh();
  return { ok: true, message: "merged" };
}

/** Delete an entry nobody uses. */
export async function deleteOrgAction(
  kind: OrgKind,
  id: string,
): Promise<void> {
  const me = await actionAdmin();
  if (kind === "school") {
    if ((await db.educationEntry.count({ where: { schoolId: id } })) > 0)
      return;
    await db.school.delete({ where: { id } });
  } else {
    if ((await db.workEntry.count({ where: { companyId: id } })) > 0) return;
    await db.company.delete({ where: { id } });
  }
  await audit(me.id, `${kind}.deleted`, { type: kind, id });
  refresh();
}
