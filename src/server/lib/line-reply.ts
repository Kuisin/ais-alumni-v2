import { webPathFor } from "@/lib/site-paths";
import type { LineTextMessage } from "@/server/lib/line";

// Replies to the rich menu's 未読のチャット / ニュース一覧 buttons (and the
// same words typed in the chat). Replies are free: they don't count toward
// LINE's monthly message allowance, unlike pushes. Pure text building here;
// loading is in line-reply-db.ts. Like every notification, replies carry no
// message content — names, counts and links only.

export type LineReplyKind = "chats" | "news";

/** Postback data sent by the rich menu buttons. */
export const LINE_POSTBACK: Record<LineReplyKind, string> = {
  chats: "chat=unread",
  news: "news=list",
};

const WORDS: Record<LineReplyKind, string[]> = {
  chats: [
    "未読",
    "未読のチャット",
    "チャット",
    "unread",
    "unreadchats",
    "chat",
  ],
  news: ["ニュース", "ニュース一覧", "お知らせ", "news", "newslist"],
};

/** Which reply a postback or a typed message asks for (null: none). */
export function lineReplyKind(input: {
  postback?: string | null;
  text?: string | null;
}): LineReplyKind | null {
  for (const kind of ["chats", "news"] as const)
    if (input.postback === LINE_POSTBACK[kind]) return kind;
  const text = input.text?.trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return null;
  for (const kind of ["chats", "news"] as const)
    if (WORDS[kind].includes(text)) return kind;
  return null;
}

type T = (key: string, values?: Record<string, string | number>) => string;
type Opts = { t: T; locale: "ja" | "en"; url: (path: string) => string };

/** LINE: 5,000 characters per text message, 5 messages per reply. */
const MAX_TEXT = 5000;
const MAX_MESSAGES = 5;
/** Room kept in each message for the closing line and link. */
const RESERVE = 300;

type Part = { text: string; item: boolean };

/**
 * Pack paragraphs into as few messages as LINE allows; items that don't
 * fit are counted in the closing line ("N more in the app").
 */
export function packReply(
  parts: readonly Part[],
  closing: (omitted: number) => string,
): LineTextMessage[] {
  const messages: string[] = [];
  let current = "";
  let omitted = 0;
  let full = false;
  for (const p of parts) {
    if (full) {
      if (p.item) omitted++;
      continue;
    }
    const next = current ? `${current}\n\n${p.text}` : p.text;
    if (next.length <= MAX_TEXT - RESERVE) {
      current = next;
      continue;
    }
    if (messages.length + 1 >= MAX_MESSAGES) {
      full = true;
      if (p.item) omitted++;
      continue;
    }
    messages.push(current);
    current = p.text.slice(0, MAX_TEXT - RESERVE);
  }
  messages.push(
    current ? `${current}\n\n${closing(omitted)}` : closing(omitted),
  );
  return messages.map((text) => ({ type: "text", text }));
}

export type ReplyChat = {
  id: string;
  name: string;
  unread: number;
  /** someone mentioned the member (or @全員) in the unread messages */
  mentioned: boolean;
};

/** 未読のチャット: talks with unread messages, each with its count and link. */
export function chatsReply(
  chats: readonly ReplyChat[],
  { t, url }: Opts,
): LineTextMessage[] {
  const list = url(webPathFor(`/app/chat`));
  const unread = chats.filter((c) => c.unread > 0);
  if (unread.length === 0)
    return [
      {
        type: "text",
        text: `${t("chats.none")}\n\n${t("chats.all")} ▶ ${list}`,
      },
    ];
  const total = unread.reduce((n, c) => n + c.unread, 0);
  return packReply(
    [
      {
        text: t("chats.head", { talks: unread.length, count: total }),
        item: false,
      },
      ...unread.map((c) => ({
        text: `■ ${c.name}　${t("chats.count", { count: c.unread })}${c.mentioned ? `　${t("chats.mentioned")}` : ""}\n${url(webPathFor(`/app/chat/${c.id}`))}`,
        item: true,
      })),
    ],
    (omitted) =>
      omitted
        ? `${t("more", { count: omitted })}\n${list}`
        : `${t("chats.all")} ▶ ${list}`,
  );
}

export type ReplyPost = {
  id: string;
  title: string;
  publishedAt: Date;
  unread: boolean;
};

function date(d: Date, locale: "ja" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** ニュース一覧: every post, 未読 first then 既読, each with its link. */
export function newsReply(
  posts: readonly ReplyPost[],
  { t, locale, url }: Opts,
): LineTextMessage[] {
  const all = url(webPathFor(`/app/news`));
  if (posts.length === 0)
    return [
      { type: "text", text: `${t("news.none")}\n\n${t("news.all")} ▶ ${all}` },
    ];
  const item = (p: ReplyPost): Part => ({
    text: `${p.title}（${date(p.publishedAt, locale)}）\n${url(webPathFor(`/app/news/${p.id}`))}`,
    item: true,
  });
  const unread = posts.filter((p) => p.unread);
  const read = posts.filter((p) => !p.unread);
  const parts: Part[] = [
    { text: t("news.head", { count: posts.length }), item: false },
  ];
  if (unread.length)
    parts.push(
      { text: `■ ${t("news.unread", { count: unread.length })}`, item: false },
      ...unread.map(item),
    );
  if (read.length)
    parts.push(
      { text: `■ ${t("news.read", { count: read.length })}`, item: false },
      ...read.map(item),
    );
  return packReply(parts, (omitted) =>
    omitted
      ? `${t("more", { count: omitted })}\n${all}`
      : `${t("news.all")} ▶ ${all}`,
  );
}
