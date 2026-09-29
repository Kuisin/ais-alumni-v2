// From the website's server actions; here plain functions the API calls.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RoleKey } from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import { AuthError, actionAdmin, type CurrentUser } from "@/server/lib/session";
import {
  parseRosterCsv,
  ROSTER_MAX_ROWS,
  type RosterParseError,
} from "@/server/lib/verification/csv";

export type RosterImportState = {
  ok: boolean;
  mode?: "preview" | "import";
  message?:
    | "forbidden"
    | "empty"
    | "tooMany"
    | "hasErrors"
    | "imported"
    | "preview"
    | "generic";
  total?: number;
  byKind?: Partial<Record<RoleKey, number>>;
  errors?: RosterParseError[];
  errorCount?: number;
  imported?: number;
} | null;

async function admin(): Promise<CurrentUser | null> {
  try {
    return await actionAdmin();
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

const inputSchema = z.object({
  csv: z.string().max(5_000_000),
  intent: z.enum(["preview", "import"]),
});

/** Preview or import the roster CSV (§6.4.1). Rows with errors block the import. */
export async function rosterImportAction(
  _prev: RosterImportState,
  formData: FormData,
): Promise<RosterImportState> {
  const me = await admin();
  if (!me) return { ok: false, message: "forbidden" };
  const parsed = inputSchema.safeParse({
    csv: formData.get("csv") ?? "",
    intent: formData.get("intent"),
  });
  if (!parsed.success) return { ok: false, message: "generic" };
  const { csv, intent } = parsed.data;

  const { rows, errors } = parseRosterCsv(csv);
  const byKind: Partial<Record<RoleKey, number>> = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  const summary = {
    mode: intent,
    total: rows.length,
    byKind,
    errors: errors.slice(0, 20),
    errorCount: errors.length,
  };

  if (!rows.length && !errors.length)
    return { ok: false, message: "empty", ...summary };
  if (rows.length > ROSTER_MAX_ROWS)
    return { ok: false, message: "tooMany", ...summary };
  if (errors.length) return { ok: false, message: "hasErrors", ...summary };
  if (intent === "preview") return { ok: true, message: "preview", ...summary };

  try {
    const res = await db.rosterEntry.createMany({ data: rows });
    await audit(me.id, "roster.import", undefined, { rows: res.count, byKind });
    revalidatePath("/[locale]/app/admin/roster", "page");
    return { ok: true, message: "imported", imported: res.count, ...summary };
  } catch (e) {
    console.error("[roster] import failed", e);
    return { ok: false, message: "generic", ...summary };
  }
}

export type RosterDeleteState = {
  ok: boolean;
  message?: "forbidden" | "confirm" | "deleted";
  deleted?: number;
} | null;

export async function deleteAllRosterAction(
  _prev: RosterDeleteState,
  formData: FormData,
): Promise<RosterDeleteState> {
  const me = await admin();
  if (!me) return { ok: false, message: "forbidden" };
  if (formData.get("confirm") !== "on")
    return { ok: false, message: "confirm" };
  const { count } = await db.rosterEntry.deleteMany({});
  await audit(me.id, "roster.deleteAll", undefined, { rows: count });
  revalidatePath("/[locale]/app/admin/roster", "page");
  return { ok: true, message: "deleted", deleted: count };
}
