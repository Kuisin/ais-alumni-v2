import type {
  AdminRoster,
  RosterDeleteResult,
  RosterImportResult,
  RosterKind,
} from "@contract/admin";
import {
  deleteAllRosterAction,
  rosterImportAction,
} from "@/server/app/actions/roster";
import { db } from "@/server/lib/db";
import { adminOnly } from "@/server/lib/mobile/admin";
import { invalid } from "@/server/lib/mobile/http";
import type { CurrentUser } from "@/server/lib/session";

/** The website's roster form's file limit (roster-import-form.tsx). */
const MAX_FILE_BYTES = 5_000_000;

/** 名簿 (the website's /app/admin/roster page; requireAdmin). */
export async function adminRoster(user: CurrentUser): Promise<AdminRoster> {
  adminOnly(user);
  const [byKind, claimed] = await Promise.all([
    db.rosterEntry.groupBy({
      by: ["kind"],
      _count: { _all: true },
      orderBy: { kind: "asc" },
    }),
    db.rosterEntry.count({ where: { claimedByUserId: { not: null } } }),
  ]);
  return {
    byKind: byKind.map((k) => ({
      kind: k.kind as RosterKind,
      count: k._count._all,
    })),
    total: byKind.reduce((n, k) => n + k._count._all, 0),
    claimed,
  };
}

/**
 * Preview or import a CSV: multipart `file` (what the app picked) or `csv`
 * (pasted text), and `intent`. The file is read as the website's form reads
 * it, then the website's action parses and imports it.
 */
export async function importRoster(
  user: CurrentUser,
  request: Request,
): Promise<RosterImportResult> {
  adminOnly(user);
  // The server's (undici) FormData; the app's types describe React Native's.
  let form: { get(name: string): unknown };
  try {
    form = (await request.formData()) as unknown as typeof form;
  } catch {
    throw invalid("invalid_form");
  }
  const file = form.get("file");
  let csv = form.get("csv");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) throw invalid("file_too_large");
    csv = await file.text();
  }
  const fd = new FormData();
  fd.set("csv", typeof csv === "string" ? csv : "");
  fd.set("intent", String(form.get("intent") ?? ""));
  return (await rosterImportAction(null, fd)) as RosterImportResult;
}

export async function deleteRoster(
  user: CurrentUser,
  confirm: boolean,
): Promise<RosterDeleteResult> {
  adminOnly(user);
  const fd = new FormData();
  if (confirm) fd.set("confirm", "on");
  return (await deleteAllRosterAction(null, fd)) ?? { ok: false };
}
