import { z } from "zod";

/**
 * Members enter their name in parts: romaji last / first / optional middle,
 * and kanji/kana 姓 / 名. The combined `nameRomaji` / `nameKanji` columns are
 * derived from the parts and used for display, search and sorting.
 */
export type NameParts = {
  lastNameRomaji: string | null;
  firstNameRomaji: string | null;
  middleNameRomaji: string | null;
  lastNameKanji: string | null;
  firstNameKanji: string | null;
  /** フリガナ (katakana) of the kanji name; undefined = leave unchanged */
  lastNameKana?: string | null;
  firstNameKana?: string | null;
};

/**
 * フリガナ: full-width katakana only. Hiragana and half-width katakana are
 * converted (ふりがな → フリガナ, ﾌﾘｶﾞﾅ → フリガナ) before checking.
 */
export function toKatakana(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\u3041-\u3096]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60),
    );
}

export function isKatakana(s: string): boolean {
  return /^[\u30A1-\u30FAー・ 　]+$/.test(s);
}

/** "姓 名" in katakana, e.g. "ヤマダ タロウ". */
export function composeKana(
  p: Pick<NameParts, "lastNameKana" | "firstNameKana">,
): string | null {
  return join([clean(p.lastNameKana), clean(p.firstNameKana)], " ");
}

function clean(s: string | null | undefined): string | null {
  const v = s?.replace(/[\s　]+/g, " ").trim();
  return v ? v : null;
}

function join(parts: (string | null)[], sep: string): string | null {
  const v = parts.filter((p): p is string => Boolean(p)).join(sep);
  return v || null;
}

/**
 * "Last, First Middle", e.g. "Yamada, Taro" or "Brown, Emma Rose". The
 * romaji name is the one shown everywhere (all languages), and lists sort by
 * it, i.e. by family name.
 */
export function composeRomaji(
  p: Pick<NameParts, "lastNameRomaji" | "firstNameRomaji" | "middleNameRomaji">,
): string | null {
  const given = join(
    [clean(p.firstNameRomaji), clean(p.middleNameRomaji)],
    " ",
  );
  return join([clean(p.lastNameRomaji), given], ", ");
}

/** "姓 名", e.g. "山田 太郎". */
export function composeKanji(
  p: Pick<NameParts, "lastNameKanji" | "firstNameKanji">,
): string | null {
  return join([clean(p.lastNameKanji), clean(p.firstNameKanji)], " ");
}

/** Normalised parts plus the derived combined names, ready to write to User. */
export function nameColumns(p: NameParts) {
  const parts = {
    lastNameRomaji: clean(p.lastNameRomaji),
    firstNameRomaji: clean(p.firstNameRomaji),
    middleNameRomaji: clean(p.middleNameRomaji),
    lastNameKanji: clean(p.lastNameKanji),
    firstNameKanji: clean(p.firstNameKanji),
  };
  const kanaGiven =
    p.lastNameKana !== undefined || p.firstNameKana !== undefined;
  const kana = kanaGiven
    ? {
        lastNameKana: clean(p.lastNameKana && toKatakana(p.lastNameKana)),
        firstNameKana: clean(p.firstNameKana && toKatakana(p.firstNameKana)),
      }
    : null;
  return {
    ...parts,
    nameRomaji: composeRomaji(parts),
    nameKanji: composeKanji(parts),
    ...(kana ? { ...kana, nameKana: composeKana(kana) } : {}),
  };
}

/** Form defaults for a user row (parts may be null on legacy rows). */
export function namePartsOf(
  u: Partial<NameParts>,
): Record<FormNameField, string> {
  return {
    lastNameRomaji: u.lastNameRomaji ?? "",
    firstNameRomaji: u.firstNameRomaji ?? "",
    middleNameRomaji: u.middleNameRomaji ?? "",
    lastNameKanji: u.lastNameKanji ?? "",
    firstNameKanji: u.firstNameKanji ?? "",
    lastNameKana: u.lastNameKana ?? "",
    firstNameKana: u.firstNameKana ?? "",
  };
}

const part = (required: boolean) =>
  required
    ? z.string().trim().min(1).max(50)
    : z
        .string()
        .trim()
        .max(50)
        .transform((v) => v || null);

/** Optional フリガナ input: converted to katakana, then checked. */
export const kanaPart = () =>
  z
    .string()
    .trim()
    .max(50, "tooLong")
    .transform((v) => (v ? toKatakana(v).replace(/\s+/g, " ").trim() : null))
    .refine((v) => v === null || isKatakana(v), "kanaOnly");

/** フリガナ is required for each kanji part that is given. */
export function requireKanaForKanji(
  v: {
    lastNameKanji: string | null;
    firstNameKanji: string | null;
    lastNameKana: string | null;
    firstNameKana: string | null;
  },
  ctx: z.RefinementCtx,
  prefix: (string | number)[] = [],
) {
  if (v.lastNameKanji && !v.lastNameKana)
    ctx.addIssue({
      code: "custom",
      path: [...prefix, "lastNameKana"],
      message: "kanaRequired",
    });
  if (v.firstNameKanji && !v.firstNameKana)
    ctx.addIssue({
      code: "custom",
      path: [...prefix, "firstNameKana"],
      message: "kanaRequired",
    });
}

/**
 * Validates the name inputs of a form: romaji required; kanji optional
 * (e.g. international students); フリガナ required with kanji.
 */
export const nameFormSchema = z
  .object({
    lastNameRomaji: part(true),
    firstNameRomaji: part(true),
    middleNameRomaji: part(false),
    lastNameKanji: part(false),
    firstNameKanji: part(false),
    lastNameKana: kanaPart(),
    firstNameKana: kanaPart(),
  })
  .superRefine((v, ctx) => requireKanaForKanji(v, ctx));

export const NAME_FIELDS = [
  "lastNameRomaji",
  "firstNameRomaji",
  "middleNameRomaji",
  "lastNameKanji",
  "firstNameKanji",
  "lastNameKana",
  "firstNameKana",
] as const;
export type FormNameField = (typeof NAME_FIELDS)[number];

/** Read the five name inputs from FormData (missing → ""). */
export function nameFormInput(fd: FormData): Record<FormNameField, string> {
  return Object.fromEntries(
    NAME_FIELDS.map((k) => [k, String(fd.get(k) ?? "")]),
  ) as Record<FormNameField, string>;
}
