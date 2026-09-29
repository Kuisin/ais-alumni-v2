// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import { educationSchema, workSchema } from "@/server/lib/history";
import type { OrgKind, OrgOption } from "@/server/lib/organizations";
import { resolveOrg, searchOrgs } from "@/server/lib/organizations-db";
import {
  AuthError,
  actionActive,
  actionAdmin,
  type CurrentUser,
} from "@/server/lib/session";
import { syncStageFromHistory } from "@/server/lib/stage";

export type HistoryFormState = {
  ok?: boolean;
  /** key in the "history" namespace */
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

async function me(): Promise<CurrentUser | null> {
  try {
    return await actionActive();
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/**
 * Whose history is edited: the member's own, or — for admins (管理 → 会員)
 * — another member's. Null when not allowed.
 */
async function target(
  userId: string,
): Promise<{ id: string; actor: CurrentUser; admin: boolean } | null> {
  if (!userId) {
    const user = await me();
    return user ? { id: user.id, actor: user, admin: false } : null;
  }
  const admin = await actionAdmin().catch(() => null);
  if (!admin || userId.length > 64) return null;
  const exists = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  return exists ? { id: userId, actor: admin, admin: true } : null;
}

/** Add or edit one 学歴 / 職歴 entry (own entries only). */
export async function saveHistoryAction(
  _prev: HistoryFormState,
  fd: FormData,
): Promise<HistoryFormState> {
  const who = await target(str(fd, "userId"));
  if (!who) return { ok: false, message: "errors.forbidden" };
  const user = { id: who.id };
  const kind = str(fd, "kind");
  const id = str(fd, "id");
  const common = {
    startYear: str(fd, "startYear"),
    endYear: str(fd, "endYear"),
    visibility: str(fd, "visibility"),
  };

  if (kind === "education") {
    const parsed = educationSchema.safeParse({
      ...common,
      level: str(fd, "level"),
      school: str(fd, "school"),
      field: str(fd, "field"),
    });
    if (!parsed.success) return invalid(parsed.error.issues);
    // Picked from the list (id) or typed as a new school (created once).
    const { school, ...rest } = parsed.data;
    const schoolId = await resolveOrg(
      "school",
      { id: str(fd, "schoolId"), name: school },
      who.actor.id,
    );
    if (!schoolId) return invalid([{ path: ["school"], message: "required" }]);
    const data = { ...rest, schoolId };
    if (id) {
      const res = await db.educationEntry.updateMany({
        where: { id, userId: user.id },
        data,
      });
      if (res.count !== 1) return { ok: false, message: "errors.forbidden" };
    } else {
      await db.educationEntry.create({ data: { ...data, userId: user.id } });
    }
  } else if (kind === "work") {
    const parsed = workSchema.safeParse({
      ...common,
      company: str(fd, "company"),
      title: str(fd, "title"),
      industry: str(fd, "industry"),
      jobType: str(fd, "jobType"),
    });
    if (!parsed.success) return invalid(parsed.error.issues);
    const { company, ...rest } = parsed.data;
    const companyId = await resolveOrg(
      "company",
      { id: str(fd, "companyId"), name: company },
      who.actor.id,
    );
    if (!companyId)
      return invalid([{ path: ["company"], message: "required" }]);
    const data = { ...rest, companyId };
    if (id) {
      const res = await db.workEntry.updateMany({
        where: { id, userId: user.id },
        data,
      });
      if (res.count !== 1) return { ok: false, message: "errors.forbidden" };
    } else {
      await db.workEntry.create({ data: { ...data, userId: user.id } });
    }
  } else {
    return { ok: false, message: "errors.invalid" };
  }

  await syncStageFromHistory(user.id);
  if (who.admin)
    await audit(
      who.actor.id,
      id ? "member.history_updated" : "member.history_added",
      { type: "User", id: user.id },
      { kind, entryId: id || null },
    );
  refresh();
  return { ok: true, message: id ? "saved" : "added" };
}

function invalid(
  issues: readonly { path: PropertyKey[]; message: string }[],
): HistoryFormState {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    fieldErrors[k] ??= i.message;
  }
  return { ok: false, message: "errors.validation", fieldErrors };
}

/** Remove an entry (own; or, for admins, `userId`'s). */
export async function deleteHistoryAction(
  kind: "education" | "work",
  id: string,
  userId = "",
): Promise<void> {
  const who = await target(typeof userId === "string" ? userId : "");
  if (!who) {
    await actionActive(); // throws the usual error for signed-out users
    return;
  }
  const where = { id, userId: who.id };
  const res =
    kind === "education"
      ? await db.educationEntry.deleteMany({ where })
      : await db.workEntry.deleteMany({ where });
  await syncStageFromHistory(who.id);
  if (who.admin && res.count)
    await audit(
      who.actor.id,
      "member.history_deleted",
      { type: "User", id: who.id },
      { kind, entryId: id },
    );
  refresh();
}

/** Suggestions for the school / company picker (signed-in members only). */
export async function searchOrgsAction(
  kind: OrgKind,
  q: string,
): Promise<OrgOption[]> {
  if (!(await me())) return [];
  if ((kind !== "school" && kind !== "company") || typeof q !== "string")
    return [];
  return searchOrgs(kind, q.slice(0, 80));
}
