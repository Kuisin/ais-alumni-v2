/**
 * @mentions in the composer and in message bubbles — the website's pure
 * helpers (src/lib/chat.ts: mentionQuery, applyMention, splitMentions),
 * repeated here because the app can't import the website's runtime code.
 * Keep them in step. Which members a message mentions is decided by the
 * server from the text (mentionsIn), as the website's composer does.
 */

/** @全員 in every language (the website room's ALL_LABELS). */
export const ALL_LABELS = ["全員", "all"];

/** An "@query" being typed right before the caret, if any. */
export function mentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (/[\n@]/.test(query) || query.length > 30) return null;
  return { start: at, query };
}

/** Replace the "@query" with "@label " and return the new caret. */
export function applyMention(
  text: string,
  start: number,
  caret: number,
  label: string,
): { text: string; caret: number } {
  const insert = `@${label} `;
  return {
    text: text.slice(0, start) + insert + text.slice(caret),
    caret: start + insert.length,
  };
}

/** Split a message into plain text and "@mention" parts (for highlighting). */
export function splitMentions(
  body: string,
  labels: readonly string[],
): { text: string; mention: boolean }[] {
  const names = [...new Set(labels.filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  if (!names.length) return [{ text: body, mention: false }];
  const out: { text: string; mention: boolean }[] = [];
  let i = 0;
  let plain = "";
  while (i < body.length) {
    const hit =
      body[i] === "@" ? names.find((n) => body.startsWith(n, i + 1)) : null;
    if (hit) {
      if (plain) out.push({ text: plain, mention: false });
      plain = "";
      out.push({ text: `@${hit}`, mention: true });
      i += hit.length + 1;
    } else {
      plain += body[i];
      i++;
    }
  }
  if (plain) out.push({ text: plain, mention: false });
  return out;
}

/**
 * フリガナ search: hiragana → katakana, half-width → full-width (the
 * website's toKatakana in src/lib/names.ts).
 */
export function toKatakana(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
