import { RoleKey } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { bestRosterMatch, type RosterApplicant } from "./roster";
import type { VerificationData } from "./schema";

/**
 * Compare an application with unclaimed roster rows of the applicant's
 * kinds (§6.4.1). Returns null when the roster has no rows to compare with
 * (the roster is optional, Open Q1).
 */
export async function computeRosterMatch(
  data: VerificationData,
): Promise<{ rowId: string; score: number } | null> {
  const base = {
    // Non-null: last/first romaji are required by the schema.
    nameRomaji: data.nameRomaji ?? "",
    nameKanji: data.nameKanji,
    nameAtAis: data.nameAtAis,
    dateOfBirth: new Date(`${data.dateOfBirth}T00:00:00Z`),
  };
  // Roster rows use role kinds; a student may be listed as current or former.
  const candidates: { kinds: RoleKey[]; applicant: RosterApplicant }[] = [];
  if (data.student) {
    candidates.push({
      kinds: [RoleKey.FORMER_STUDENT, RoleKey.CURRENT_STUDENT],
      applicant: {
        ...base,
        yearsFrom: data.student.joinedYear,
        yearsTo: data.student.leftYear,
      },
    });
  }
  if (data.teacher) {
    candidates.push({
      kinds: [RoleKey.TEACHER],
      applicant: {
        ...base,
        yearsFrom: data.teacher.joinedYear,
        yearsTo: data.teacher.leftYear,
      },
    });
  }
  if (data.parent) {
    candidates.push({
      kinds: [RoleKey.CURRENT_PARENT, RoleKey.FORMER_PARENT],
      applicant: base,
    });
  }

  const kinds = candidates.flatMap((c) => c.kinds);
  const rows = await db.rosterEntry.findMany({
    where: { kind: { in: kinds }, claimedByUserId: null },
    select: {
      id: true,
      kind: true,
      nameRomaji: true,
      nameKanji: true,
      dateOfBirth: true,
      yearsFrom: true,
      yearsTo: true,
    },
  });
  if (!rows.length) return null;

  let best: { rowId: string; score: number } | null = null;
  for (const c of candidates) {
    const m = bestRosterMatch(
      c.applicant,
      rows.filter((r) => c.kinds.includes(r.kind)),
    );
    if (m && (!best || m.score > best.score)) best = m;
  }
  return best;
}

/**
 * A child's record (entered by a parent) against unclaimed student roster
 * rows. Returns the best row and score, or null if there is nothing to
 * compare with.
 */
export async function matchStudentRoster(
  child: RosterApplicant,
): Promise<{ rowId: string; score: number } | null> {
  const rows = await db.rosterEntry.findMany({
    where: {
      kind: { in: [RoleKey.FORMER_STUDENT, RoleKey.CURRENT_STUDENT] },
      claimedByUserId: null,
    },
    select: {
      id: true,
      kind: true,
      nameRomaji: true,
      nameKanji: true,
      dateOfBirth: true,
      yearsFrom: true,
      yearsTo: true,
    },
  });
  return rows.length ? bestRosterMatch(child, rows) : null;
}
