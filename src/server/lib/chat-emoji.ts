/**
 * What counts as a chat reaction (src/server/lib/mobile/chat-reactions.ts,
 * and the demo account's fixture): one emoji — a single grapheme cluster
 * with a pictographic code point (or a keycap), never text. Pure: no
 * database.
 */

const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
/** Keycaps (#️⃣, 1️⃣ …) have no pictographic code point of their own. */
const KEYCAP = /^[0-9#*]\u{FE0F}?\u{20E3}$/u;
/** One emoji sequence: a flag, a keycap, or pictographs joined by ZWJ. */
const ONE_EMOJI =
  /^(?:\p{Regional_Indicator}{2}|[0-9#*]\u{FE0F}?\u{20E3}|\p{Extended_Pictographic}[\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]*(?:\u{200D}\p{Extended_Pictographic}[\u{FE0F}\u{1F3FB}-\u{1F3FF}]*)*)$/u;

function graphemes(s: string): number {
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Seg) return ONE_EMOJI.test(s) ? 1 : 2;
  let n = 0;
  for (const _ of new Seg(undefined, { granularity: "grapheme" }).segment(s))
    n++;
  return n;
}

/** Longest emoji accepted (UTF-16 units; ZWJ families are ~11). */
export const MAX_EMOJI_LENGTH = 32;

/** One emoji: a single grapheme with a pictographic code point, no text. */
export function isReactionEmoji(raw: string): boolean {
  const s = raw.trim();
  if (!s || s.length > MAX_EMOJI_LENGTH) return false;
  if (graphemes(s) !== 1) return false;
  return PICTOGRAPHIC.test(s) || KEYCAP.test(s);
}
