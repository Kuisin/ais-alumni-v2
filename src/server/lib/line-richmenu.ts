import { AccountState, type Locale } from "@/server/generated/prisma/enums";
import { lineConfigured, lineRequest } from "@/server/lib/line";
import { LINE_POSTBACK } from "@/server/lib/line-reply";
import { publicUrl } from "@/server/lib/urls";

/**
 * The Official Account's rich menu, shown under the chat instead of the
 * keyboard (selected: true): two buttons on top that ask for unread chats /
 * the news list — answered by a free reply (line-reply.ts), not a push — and a
 * 3 × 2 grid of app pages below. Each language comes in four variants: a
 * red dot on 未読のチャット / チャット and on ニュース一覧 / ニュース when the
 * member has something unread (aliases ais-menu-ja, ais-menu-ja-chat,
 * ais-menu-ja-news, ais-menu-ja-chat-news, and the same for en). The plain
 * Japanese menu is the default; everyone else gets theirs linked, kept in
 * step by line-menu-sync.ts (Supabase pg_cron, every minute). Installed from
 * 管理 → LINEメニュー (installRichMenus).
 */

export const RICH_MENU_ITEMS = [
  { key: "dashboard", path: "/app/dashboard" },
  { key: "news", path: "/app/news" },
  { key: "events", path: "/app/events" },
  { key: "chat", path: "/app/chat" },
  { key: "directory", path: "/app/directory" },
  { key: "settings", path: "/app/settings" },
] as const;

/** Top row: buttons that post back and get a reply in the chat. */
export const RICH_MENU_REPLIES = [
  { key: "chats", data: LINE_POSTBACK.chats },
  { key: "newsList", data: LINE_POSTBACK.news },
] as const;

export type RichMenuPageKey = (typeof RICH_MENU_ITEMS)[number]["key"];
export type RichMenuReplyKey = (typeof RICH_MENU_REPLIES)[number]["key"];
export type RichMenuKey = RichMenuPageKey | RichMenuReplyKey;

export const RICH_MENU_SIZE = { width: 2500, height: 1686 } as const;
const COLS = 3;
/** One row of reply buttons, then two rows of pages. */
const ROWS = 3;

/** Which of the member's things are unread (a red dot in the menu). */
export type RichMenuBadges = { chats: boolean; news: boolean };

export const NO_BADGES: RichMenuBadges = { chats: false, news: false };

/** Every variant: two languages × unread chats × unread news. */
export const RICH_MENU_VARIANTS: { locale: Locale; badges: RichMenuBadges }[] =
  (["ja", "en"] as const).flatMap((locale) =>
    [false, true].flatMap((chats) =>
      [false, true].map((news) => ({ locale, badges: { chats, news } })),
    ),
  );

/** Variant key ("ja", "ja-chat", "en-news", "en-chat-news" …). */
export function richMenuKey(locale: Locale, badges: RichMenuBadges): string {
  return [locale, badges.chats && "chat", badges.news && "news"]
    .filter(Boolean)
    .join("-");
}

/** The default menu (not linked per member): Japanese, nothing unread. */
export const DEFAULT_RICH_MENU_KEY = richMenuKey("ja", NO_BADGES);

/** The variant a member should see (members not yet active: no dots). */
export function lineMenuKeyFor(
  user: { locale: Locale | string; state: AccountState | string },
  badges: RichMenuBadges,
): string {
  return richMenuKey(
    user.locale === "en" ? "en" : "ja",
    user.state === AccountState.ACTIVE ? badges : NO_BADGES,
  );
}

export function richMenuAlias(key: string): string {
  return `ais-menu-${key}`;
}

function rowBounds(row: number) {
  const y0 = Math.round((RICH_MENU_SIZE.height * row) / ROWS);
  const y1 = Math.round((RICH_MENU_SIZE.height * (row + 1)) / ROWS);
  return { y: y0, height: y1 - y0 };
}

/** Reply button bounds: the top row, split in two. */
export function replyBounds(i: number) {
  const x0 = Math.round((RICH_MENU_SIZE.width * i) / RICH_MENU_REPLIES.length);
  const x1 = Math.round(
    (RICH_MENU_SIZE.width * (i + 1)) / RICH_MENU_REPLIES.length,
  );
  return { x: x0, ...rowBounds(0), width: x1 - x0 };
}

/** Page tile bounds (3 × 2 under the reply row), whole pixels, no gaps. */
export function tileBounds(i: number) {
  const col = i % COLS;
  const row = Math.floor(i / COLS) + 1;
  const x0 = Math.round((RICH_MENU_SIZE.width * col) / COLS);
  const x1 = Math.round((RICH_MENU_SIZE.width * (col + 1)) / COLS);
  const y0 = Math.round((RICH_MENU_SIZE.height * row) / ROWS);
  const y1 = Math.round((RICH_MENU_SIZE.height * (row + 1)) / ROWS);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The rich menu object (Messaging API) for one language / variant. */
export function richMenuBody(
  locale: Locale,
  labels: Record<RichMenuKey, string>,
  chatBarText: string,
  badges: RichMenuBadges = NO_BADGES,
) {
  return {
    size: RICH_MENU_SIZE,
    selected: true,
    name: `AIS Alumni menu (${richMenuKey(locale, badges)})`,
    chatBarText,
    areas: [
      // The label also shows in the chat as the member's message.
      ...RICH_MENU_REPLIES.map((item, i) => ({
        bounds: replyBounds(i),
        action: {
          type: "postback" as const,
          label: labels[item.key].slice(0, 20),
          data: item.data,
          displayText: labels[item.key],
        },
      })),
      ...RICH_MENU_ITEMS.map((item, i) => ({
        bounds: tileBounds(i),
        action: {
          type: "uri" as const,
          label: labels[item.key].slice(0, 20),
          uri: publicUrl(`/${locale}${item.path}`),
        },
      })),
    ],
  };
}

async function aliasTarget(alias: string): Promise<string | null> {
  try {
    const r = await lineRequest<{ richMenuId: string }>(
      "GET",
      `/richmenu/alias/${alias}`,
    );
    return r.richMenuId ?? null;
  } catch {
    return null;
  }
}

/** Installed menus by variant key (from the aliases, one request). */
export async function richMenuIds(): Promise<Map<string, string>> {
  const { aliases } = await lineRequest<{
    aliases?: { richMenuAliasId: string; richMenuId: string }[];
  }>("GET", "/richmenu/alias/list");
  const ids = new Map<string, string>();
  for (const a of aliases ?? [])
    if (a.richMenuAliasId.startsWith("ais-menu-"))
      ids.set(a.richMenuAliasId.slice("ais-menu-".length), a.richMenuId);
  return ids;
}

/**
 * Create every variant, upload its image, point its alias at it and make
 * the plain Japanese menu the default. Then `relink` gives each member their
 * variant (the new menus have new IDs), and older menus are deleted.
 */
export async function installRichMenus(
  build: (
    locale: Locale,
    badges: RichMenuBadges,
  ) => Promise<{
    body: ReturnType<typeof richMenuBody>;
    image: ArrayBuffer;
  }>,
  relink: () => Promise<number>,
): Promise<{ ids: Record<string, string>; linked: number; removed: number }> {
  const ids: Record<string, string> = {};
  for (const { locale, badges } of RICH_MENU_VARIANTS) {
    const key = richMenuKey(locale, badges);
    const { body, image } = await build(locale, badges);
    await lineRequest("POST", "/richmenu/validate", body);
    const { richMenuId } = await lineRequest<{ richMenuId: string }>(
      "POST",
      "/richmenu",
      body,
    );
    await lineRequest("POST", `/richmenu/${richMenuId}/content`, image, {
      data: true,
      contentType: "image/png",
    });
    const alias = richMenuAlias(key);
    if (await aliasTarget(alias))
      await lineRequest("POST", `/richmenu/alias/${alias}`, { richMenuId });
    else
      await lineRequest("POST", "/richmenu/alias", {
        richMenuAliasId: alias,
        richMenuId,
      });
    ids[key] = richMenuId;
  }
  await lineRequest("POST", `/user/all/richmenu/${ids[DEFAULT_RICH_MENU_KEY]}`);

  const linked = await relink();

  const { richmenus } = await lineRequest<{
    richmenus: { richMenuId: string }[];
  }>("GET", "/richmenu/list");
  const keep = new Set(Object.values(ids));
  let removed = 0;
  for (const m of richmenus ?? []) {
    if (keep.has(m.richMenuId)) continue;
    await lineRequest("DELETE", `/richmenu/${m.richMenuId}`).catch(() => {});
    removed++;
  }
  return { ids, linked, removed };
}

/** Current state for the admin page (null when not installed/configured). */
export async function richMenuStatus(): Promise<{
  configured: boolean;
  installed: Record<Locale, string | null>;
  defaultId: string | null;
}> {
  if (!lineConfigured())
    return {
      configured: false,
      installed: { ja: null, en: null },
      defaultId: null,
    };
  const [ja, en, def] = await Promise.all([
    aliasTarget(richMenuAlias(richMenuKey("ja", NO_BADGES))),
    aliasTarget(richMenuAlias(richMenuKey("en", NO_BADGES))),
    lineRequest<{ richMenuId: string }>("GET", "/user/all/richmenu")
      .then((r) => r.richMenuId ?? null)
      .catch(() => null),
  ]);
  return { configured: true, installed: { ja, en }, defaultId: def };
}
