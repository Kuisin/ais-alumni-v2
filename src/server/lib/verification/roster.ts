/**
 * Roster matching (§6.4.1). Pure, no DB access — see roster.test.ts.
 *
 * The roster is optional (Open Q1): with no rows of the applicant's kind the
 * matcher returns null and admins review without a score.
 *
 * Score 0–100 = name (60) + date of birth (25) + years attended (15).
 * When either side lacks DOB or years, that component gets half credit so a
 * missing value neither rewards nor penalises heavily (assumption).
 */

export const NAME_WEIGHT = 60;
export const DOB_WEIGHT = 25;
export const YEARS_WEIGHT = 15;

/** Score at/above which a roster row counts as "matched" (claimed on approval). */
export const ROSTER_MATCH_THRESHOLD = 70;

/** Name similarity (0–1) at/above which a member is taken as the named person (vouching). */
export const NAME_MATCH_THRESHOLD = 0.85;

const CJK = /[぀-ヿ㐀-鿿豈-﫿]/;

export function isCjk(s: string): boolean {
  return CJK.test(s);
}

/** Lowercase, strip accents and punctuation, split into tokens (original order). */
export function romajiRawTokens(s: string): string[] {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Tokens sorted, so comparison is order-insensitive. */
export function romajiTokens(s: string): string[] {
  return romajiRawTokens(s).sort();
}

/** Kanji/kana: NFKC, remove all whitespace (incl. ideographic space) and middle dots. */
export function normalizeKanji(s: string): string {
  return s.normalize("NFKC").replace(/[\s\u3000・·]/g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 0;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Romaji similarity 0–1. Order-insensitive ("Taro Yamada" = "YAMADA Taro"),
 * tolerant of spacing ("Yamada Taro" ≈ "Yamadataro") and small typos. If one
 * name's tokens all appear (fuzzily) in the other — e.g. a middle name was
 * added — it scores 0.9.
 */
export function romajiSimilarity(a: string, b: string): number {
  const ta = romajiTokens(a);
  const tb = romajiTokens(b);
  if (!ta.length || !tb.length) return 0;
  const joined = ratio(ta.join(" "), tb.join(" "));
  // Spacing differences ("Yamadataro" vs "Yamada Taro"): compare squashed
  // strings in both name orders.
  const ra = romajiRawTokens(a);
  const rb = romajiRawTokens(b);
  const squashed = Math.max(
    ratio(ra.join(""), rb.join("")),
    ratio(ra.join(""), [...rb].reverse().join("")),
    ratio([...ra].reverse().join(""), rb.join("")),
  );
  let best = Math.max(joined, squashed);

  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length < long.length && short.length >= 2) {
    const allFound = short.every((tok) =>
      long.some((l) => ratio(tok, l) >= 0.8),
    );
    if (allFound) best = Math.max(best, 0.9);
  }
  return Math.max(0, Math.min(1, best));
}

function bigrams(s: string): string[] {
  if (s.length < 2) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** Kanji/kana similarity: exact 1, containment 0.8, else bigram Dice × 0.7. */
export function kanjiSimilarity(a: string, b: string): number {
  const na = normalizeKanji(a);
  const nb = normalizeKanji(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 2 && long.includes(short)) return 0.8;
  const ba = bigrams(na);
  const bb = bigrams(nb);
  const pool = [...bb];
  let common = 0;
  for (const g of ba) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      common++;
      pool.splice(i, 1);
    }
  }
  return ((2 * common) / (ba.length + bb.length)) * 0.7;
}

/** Similarity of two names of any script (CJK compared as kanji, else romaji). */
export function nameSimilarity(a: string, b: string): number {
  const ca = isCjk(a);
  const cb = isCjk(b);
  if (ca && cb) return kanjiSimilarity(a, b);
  if (!ca && !cb) return romajiSimilarity(a, b);
  return 0;
}

/** Best similarity between any pair of name variants. */
export function bestNameSimilarity(
  as: readonly (string | null | undefined)[],
  bs: readonly (string | null | undefined)[],
): number {
  let best = 0;
  for (const a of as) {
    if (!a?.trim()) continue;
    for (const b of bs) {
      if (!b?.trim()) continue;
      best = Math.max(best, nameSimilarity(a, b));
    }
  }
  return best;
}

export type RosterCandidate = {
  id: string;
  nameRomaji: string;
  nameKanji: string | null;
  dateOfBirth: Date | null;
  yearsFrom: number | null;
  yearsTo: number | null;
};

export type RosterApplicant = {
  nameRomaji: string;
  nameKanji?: string | null;
  nameAtAis?: string | null;
  dateOfBirth: Date | null;
  yearsFrom?: number | null;
  /** null = still there ("present") */
  yearsTo?: number | null;
};

function dobScore(a: Date | null, b: Date | null): number {
  if (!a || !b) return 0.5;
  const ay = a.getUTCFullYear();
  const am = a.getUTCMonth();
  const ad = a.getUTCDate();
  const by = b.getUTCFullYear();
  const bm = b.getUTCMonth();
  const bd = b.getUTCDate();
  if (ay === by && am === bm && ad === bd) return 1;
  // day/month swapped (DD/MM vs MM/DD entry mistakes)
  if (ay === by && am + 1 === bd && ad === bm + 1) return 0.6;
  if (ay === by && am === bm) return 0.4;
  if (am === bm && ad === bd && Math.abs(ay - by) === 1) return 0.4;
  return 0;
}

function yearsScore(
  aFrom: number | null | undefined,
  aTo: number | null | undefined,
  bFrom: number | null,
  bTo: number | null,
  now: Date,
): number {
  if (aFrom == null || bFrom == null) return 0.5;
  const current = now.getUTCFullYear();
  const aEnd = aTo ?? current;
  const bEnd = bTo ?? current;
  const overlap = Math.min(aEnd, bEnd) - Math.max(aFrom, bFrom) + 1;
  if (overlap <= 0) return 0;
  const shorter = Math.min(aEnd - aFrom, bEnd - bFrom) + 1;
  return Math.min(1, overlap / Math.max(1, shorter));
}

/** Score one roster row against the applicant (0–100). */
export function scoreRosterRow(
  applicant: RosterApplicant,
  row: RosterCandidate,
  now: Date = new Date(),
): number {
  const name = bestNameSimilarity(
    [applicant.nameRomaji, applicant.nameKanji, applicant.nameAtAis],
    [row.nameRomaji, row.nameKanji],
  );
  const dob = dobScore(applicant.dateOfBirth, row.dateOfBirth);
  const years = yearsScore(
    applicant.yearsFrom,
    applicant.yearsTo,
    row.yearsFrom,
    row.yearsTo,
    now,
  );
  return Math.round(
    NAME_WEIGHT * name + DOB_WEIGHT * dob + YEARS_WEIGHT * years,
  );
}

/** Best roster row, or null when there are no rows to compare against. */
export function bestRosterMatch(
  applicant: RosterApplicant,
  rows: readonly RosterCandidate[],
  now: Date = new Date(),
): { rowId: string; score: number } | null {
  let best: { rowId: string; score: number } | null = null;
  for (const row of rows) {
    const score = scoreRosterRow(applicant, row, now);
    if (!best || score > best.score) best = { rowId: row.id, score };
  }
  return best;
}
