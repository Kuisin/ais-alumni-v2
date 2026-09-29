/**
 * Minimal, safe Markdown → HTML renderer for admin-authored event/news bodies.
 *
 * Safety model: the whole input is HTML-escaped FIRST, then a small set of
 * Markdown constructs is turned into a fixed whitelist of tags. No raw HTML
 * from the source ever reaches the output, and link targets are restricted to
 * http(s): and mailto:.
 *
 * Supported: paragraphs (single newlines become <br>), # headings (mapped to
 * h2–h4 because the page title is the h1), unordered (-, *, +) and ordered
 * (1.) lists, **bold** / __bold__, *italic* / _italic_, `code`,
 * [text](url) links and bare http(s) URLs.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

export function isSafeUrl(url: string): boolean {
  return SAFE_URL.test(url);
}

const PH = "\u0000";

/** Inline formatting on an already-escaped line. */
function renderInline(escaped: string): string {
  const slots: string[] = [];
  const hold = (html: string) => {
    slots.push(html);
    return `${PH}${slots.length - 1}${PH}`;
  };

  let s = escaped;
  // `code` first so its content is not formatted.
  s = s.replace(/`([^`]+)`/g, (_m, code: string) =>
    hold(`<code>${code}</code>`),
  );
  // [label](url) — the url cannot contain whitespace or ")".
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, url: string) => {
      if (!isSafeUrl(url)) return label;
      return hold(
        `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${emphasis(label)}</a>`,
      );
    },
  );
  // Bare URLs. Trailing punctuation is left outside the link.
  s = s.replace(/https?:\/\/[^\s<]+/g, (raw) => {
    const m = raw.match(/^(.*?)([.,;:!?]*)$/) as RegExpMatchArray;
    const url = m[1];
    return (
      hold(
        `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`,
      ) + m[2]
    );
  });
  s = emphasis(s);
  return s.replace(
    new RegExp(`${PH}(\\d+)${PH}`, "g"),
    (_m, i: string) => slots[Number(i)],
  );
}

function emphasis(s: string): string {
  return s
    .replace(/\*\*(?=\S)(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])__(?=\S)(.+?)__(?!\w)/g, "$1<strong>$2</strong>")
    .replace(/\*(?=\S)([^*]+?)\*/g, "<em>$1</em>")
    .replace(/(^|[^\w])_(?=\S)([^_]+?)_(?!\w)/g, "$1<em>$2</em>");
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul" | "ol"; items: string[] };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const UL_ITEM = /^\s*[-*+]\s+(.*)$/;
const OL_ITEM = /^\s*\d{1,9}[.)]\s+(.*)$/;

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  // Cast: `current` is reassigned inside flush(), which TS narrowing cannot see.
  let current = null as Block | null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const line of src.split("\n")) {
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
      const text = (ul ?? ol)?.[1] ?? "";
      if (current?.kind !== kind) {
        flush();
        current = { kind, items: [] };
      }
      (current as { items: string[] }).items.push(text);
      continue;
    }
    if (current?.kind === "p") {
      current.lines.push(line.trim());
    } else {
      flush();
      current = { kind: "p", lines: [line.trim()] };
    }
  }
  flush();
  return blocks;
}

/** Render Markdown to a safe HTML string. */
export function renderMarkdown(src: string | null | undefined): string {
  if (!src) return "";
  const clean = src.replace(/\r\n?/g, "\n").replaceAll(PH, "");
  const blocks = parseBlocks(escapeHtml(clean));
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "h": {
          const tag = `h${Math.min(b.level + 1, 4)}`;
          return `<${tag}>${renderInline(b.text)}</${tag}>`;
        }
        case "ul":
        case "ol":
          return `<${b.kind}>${b.items.map((i) => `<li>${renderInline(i)}</li>`).join("")}</${b.kind}>`;
        default:
          return `<p>${b.lines.map(renderInline).join("<br>")}</p>`;
      }
    })
    .join("\n");
}

/** Plain-text version (for previews and LINE/email excerpts). Not HTML-escaped. */
export function markdownToPlain(
  src: string | null | undefined,
  maxLength?: number,
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
  if (maxLength && text.length > maxLength)
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  return text;
}
