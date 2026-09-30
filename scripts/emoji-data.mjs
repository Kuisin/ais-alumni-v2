// Regenerates src/features/chat/room/emoji-data.json — the chat reaction
// picker's emoji (no skin tones; up to Emoji 15.0, which current iOS and
// Android phones all draw), with English and Japanese names and search
// words — from emojibase-data (MIT, https://emojibase.dev):
//   node scripts/emoji-data.mjs [version]
import { writeFileSync } from "node:fs";

const version = process.argv[2] ?? "17";
const MAX_EMOJI_VERSION = 15;
const url = (file) =>
  `https://cdn.jsdelivr.net/npm/emojibase-data@${version}/${file}`;
const [en, ja, full] = await Promise.all(
  ["en/compact.json", "ja/compact.json", "en/data.json"].map((f) =>
    fetch(url(f)).then((r) => r.json()),
  ),
);
const jaByHex = new Map(ja.map((e) => [e.hexcode, e]));
const versionOf = new Map(full.map((e) => [e.hexcode, e.version]));
// emojibase groups; 2 (skin-tone components) is left out.
const GROUPS = [
  [0, "smileys"],
  [1, "people"],
  [3, "animals"],
  [4, "food"],
  [5, "travel"],
  [6, "activities"],
  [7, "objects"],
  [8, "symbols"],
  [9, "flags"],
];
const clean = (s) => String(s ?? "").replace(/[\t\n]/g, " ");
const groups = GROUPS.map(([n, key]) => ({
  key,
  // One line per emoji: emoji \t English name \t Japanese name \t search words
  items: en
    .filter(
      (e) =>
        e.group === n && (versionOf.get(e.hexcode) ?? 99) <= MAX_EMOJI_VERSION,
    )
    .sort((a, b) => a.order - b.order)
    .map((e) => {
      const j = jaByHex.get(e.hexcode);
      const words = [...new Set([...(e.tags ?? []), ...(j?.tags ?? [])])];
      return [e.unicode, e.label, j?.label ?? e.label, words.join(" ")]
        .map(clean)
        .join("\t");
    })
    .join("\n"),
}));
const out = {
  source: `emojibase-data@${version} (MIT) — scripts/emoji-data.mjs`,
  groups,
};
writeFileSync(
  new URL("../src/features/chat/room/emoji-data.json", import.meta.url),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(
  groups.map((g) => `${g.key}: ${g.items.split("\n").length}`).join(", "),
);
