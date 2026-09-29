import type { Prisma } from "@/server/generated/prisma/client";
import { AccountState, RoleKey } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { toKatakana } from "@/server/lib/names";
import { NOTIFY_USER_SELECT, notify } from "@/server/lib/notify";
import {
  bestNameSimilarity,
  isCjk,
  NAME_MATCH_THRESHOLD,
  normalizeKanji,
  romajiRawTokens,
} from "./roster";

/**
 * Vouching (§6.4.2). Classmate / homeroom-teacher names from the form are
 * matched against ACTIVE members; each match is asked "Do you know X?".
 */

export const MAX_MATCHES_PER_NAME = 2;
export const MAX_AUTO_VOUCHES = 6;

export type VouchRef = { name: string; teacherOnly: boolean };

/** Reference names from stored answers (lenient: answers are JSON). */
export function vouchRefsFromAnswers(answers: unknown): VouchRef[] {
  const a = (answers ?? {}) as {
    student?: { classmates?: unknown; homeroomTeacher?: unknown };
  };
  const refs: VouchRef[] = [];
  const add = (name: unknown, teacherOnly: boolean) => {
    if (typeof name === "string" && name.trim())
      refs.push({ name: name.trim(), teacherOnly });
  };
  if (Array.isArray(a.student?.classmates)) {
    for (const c of a.student.classmates) add(c, false);
  }
  add(a.student?.homeroomTeacher, true);
  return refs;
}

/** "2006–2014", "2020–" (still at AIS), or "" when no years were given. */
export function yearsFromAnswers(
  answers: unknown,
  presentLabel: string,
): string {
  const a = (answers ?? {}) as Record<
    string,
    { joinedYear?: unknown; leftYear?: unknown } | undefined
  >;
  for (const key of ["student", "teacher"]) {
    const s = a[key];
    if (s && typeof s.joinedYear === "number") {
      const to =
        typeof s.leftYear === "number" ? String(s.leftYear) : presentLabel;
      return `${s.joinedYear}–${to}`;
    }
  }
  return "";
}

function prefilter(name: string): Prisma.UserWhereInput[] {
  if (isCjk(name)) {
    const n = normalizeKanji(name);
    const parts = name.split(/[\s　]+/).filter((p) => p.length >= 1);
    const needles = parts.length > 1 ? parts : [n.slice(0, 2), n.slice(-2)];
    return needles.filter(Boolean).map((p) => ({ nameKanji: { contains: p } }));
  }
  const tokens = romajiRawTokens(name).filter((t) => t.length >= 2);
  return tokens.flatMap((t) => [
    { nameRomaji: { contains: t, mode: "insensitive" as const } },
    { nameAtAis: { contains: t, mode: "insensitive" as const } },
    { nameKana: { contains: toKatakana(t) } },
  ]);
}

export type MemberMatch = {
  id: string;
  nameRomaji: string | null;
  nameKanji: string | null;
  score: number;
};

/** ACTIVE members whose name looks like `name`, best first. */
export async function findMembersByName(
  name: string,
  opts: {
    teacherOnly?: boolean;
    excludeUserIds?: string[];
    threshold?: number;
    limit?: number;
  },
): Promise<MemberMatch[]> {
  const or = prefilter(name);
  if (!or.length) return [];
  const candidates = await db.user.findMany({
    where: {
      state: AccountState.ACTIVE,
      id: opts.excludeUserIds?.length
        ? { notIn: opts.excludeUserIds }
        : undefined,
      OR: or,
      ...(opts.teacherOnly
        ? { roles: { some: { role: RoleKey.TEACHER } } }
        : {}),
    },
    select: { id: true, nameRomaji: true, nameKanji: true, nameAtAis: true },
    take: 200,
  });
  const threshold = opts.threshold ?? NAME_MATCH_THRESHOLD;
  return candidates
    .map((c) => ({
      id: c.id,
      nameRomaji: c.nameRomaji,
      nameKanji: c.nameKanji,
      score: bestNameSimilarity(
        [name],
        [c.nameRomaji, c.nameKanji, c.nameAtAis],
      ),
    }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? MAX_MATCHES_PER_NAME);
}

/** Send the "Do you know X?" message for one vouch row. Never throws. */
export async function notifyVoucher(vouchId: string): Promise<void> {
  try {
    const vouch = await db.vouch.findUnique({
      where: { id: vouchId },
      include: {
        voucher: { select: NOTIFY_USER_SELECT },
        request: {
          select: {
            answers: true,
            user: { select: { nameRomaji: true, nameKanji: true } },
          },
        },
      },
    });
    if (!vouch) return;
    await notify(vouch.voucher, {
      kind: "VOUCH_REQUEST",
      refId: vouch.id,
      dedupe: true,
      path: `/app/vouch/${vouch.id}`,
      params: async (locale) => {
        const t = await getTranslatorFor(locale, "vouch");
        return {
          name: displayName(vouch.request.user, locale),
          years: yearsFromAnswers(vouch.request.answers, t("present")) ?? "",
        };
      },
    });
  } catch (e) {
    console.error(`[vouch] notify ${vouchId} failed`, e);
  }
}

/**
 * Create vouch requests for the reference names in the answers, skipping
 * members already asked for this request, and notify the new vouchers.
 */
export async function createVouchesForRequest(
  requestId: string,
): Promise<number> {
  const request = await db.verificationRequest.findUnique({
    where: { id: requestId },
    select: {
      userId: true,
      answers: true,
      vouches: { select: { voucherId: true } },
    },
  });
  if (!request) return 0;
  const asked = new Set(request.vouches.map((v) => v.voucherId));
  const budget = MAX_AUTO_VOUCHES - asked.size;
  if (budget <= 0) return 0;

  const chosen: string[] = [];
  for (const ref of vouchRefsFromAnswers(request.answers)) {
    const matches = await findMembersByName(ref.name, {
      teacherOnly: ref.teacherOnly,
      excludeUserIds: [request.userId, ...asked, ...chosen],
    });
    for (const m of matches) {
      if (chosen.length >= budget) break;
      chosen.push(m.id);
    }
  }

  let created = 0;
  for (const voucherId of chosen) {
    const vouch = await db.vouch
      .create({ data: { requestId, voucherId } })
      .catch(() => null); // unique (requestId, voucherId) race — already asked
    if (!vouch) continue;
    created++;
    await notifyVoucher(vouch.id);
  }
  return created;
}
