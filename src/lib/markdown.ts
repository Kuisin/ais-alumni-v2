/**
 * The website's Markdown subset (src/lib/markdown.ts), parsed into blocks and
 * styled runs for native rendering (src/ui/markdown.tsx). Pure: no imports.
 */

export type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul" | "ol"; items: string[] };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const UL_ITEM = /^\s*[-*+]\s+(.*)$/;
const OL_ITEM = /^\s*\d{1,9}[.)]\s+(.*)$/;

export function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  let current = null as Block | null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const line of src.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = line.match(HEADING);
    if (h) {
      flush();
      blocks.push({ kind: "h", level: h[1].length, text: h[2] });
      continue;
    }
    const ul = line.match(UL_ITEM);
    const ol = ul ? null : line.match(OL_ITEM);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (current?.kind !== kind) {
        flush();
        current = { kind, items: [] };
      }
      (current as { items: string[] }).items.push((ul ?? ol)?.[1] ?? "");
      continue;
    }
    if (current?.kind === "p") current.lines.push(line.trim());
    else {
      flush();
      current = { kind: "p", lines: [line.trim()] };
    }
  }
  flush();
  return blocks;
}

export type Inline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
};

const SAFE_URL = /^(https?:\/\/|mailto:)/i;
const TOKENS = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|https?:\/\/[^\s<]+/g;

function emphasis(text: string, base: Inline = { text: "" }): Inline[] {
  const out: Inline[] = [];
  const bold = /\*\*(?=\S)(.+?)\*\*|(^|[^\w])__(?=\S)(.+?)__(?!\w)/g;
  let last = 0;
  for (const m of text.matchAll(bold)) {
    const lead = m[2] ?? "";
    const start = (m.index ?? 0) + lead.length;
    out.push(...italic(text.slice(last, start), base));
    out.push(...italic(m[1] ?? m[3] ?? "", { ...base, bold: true }));
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(...italic(text.slice(last), base));
  return out.filter((s) => s.text);
}

function italic(text: string, base: Inline): Inline[] {
  const out: Inline[] = [];
  const re = /\*(?=\S)([^*]+?)\*|(^|[^\w])_(?=\S)([^_]+?)_(?!\w)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const lead = m[2] ?? "";
    const start = (m.index ?? 0) + lead.length;
    out.push({ ...base, text: text.slice(last, start) });
    out.push({ ...base, italic: true, text: m[1] ?? m[3] ?? "" });
    last = (m.index ?? 0) + m[0].length;
  }
  out.push({ ...base, text: text.slice(last) });
  return out;
}

/** One line of Markdown → styled runs. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKENS)) {
    const at = m.index ?? 0;
    out.push(...emphasis(line.slice(last, at)));
    if (m[1] !== undefined) out.push({ text: m[1], code: true });
    else if (m[2] !== undefined) {
      const url = m[3] ?? "";
      out.push(
        ...(SAFE_URL.test(url)
          ? emphasis(m[2], { text: "", href: url })
          : emphasis(m[2])),
      );
    } else {
      const [, url = "", trail = ""] = m[0].match(/^(.*?)([.,;:!?]*)$/) ?? [];
      out.push({ text: url, href: url });
      if (trail) out.push({ text: trail });
    }
    last = at + m[0].length;
  }
  out.push(...emphasis(line.slice(last)));
  return out.filter((s) => s.text);
}

/** Plain text for previews (as markdownToPlain on the website). */
export function markdownToPlain(
  src: string | null | undefined,
  max?: number,
): string {
  if (!src) return "";
  const text = src
    .replace(/\r\n?/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/(\*\*|__)(?=\S)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_](?=\S)([^*_]+?)[*_](?!\w)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return max && text.length > max
    ? `${text.slice(0, max - 1).trimEnd()}…`
    : text;
}
