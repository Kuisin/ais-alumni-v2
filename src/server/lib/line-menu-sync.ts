import type { Prisma } from "@/server/generated/prisma/client";
import { db } from "@/server/lib/db";
import { lineConfigured, lineRequest } from "@/server/lib/line";
import {
  DEFAULT_RICH_MENU_KEY,
  lineMenuKeyFor,
  NO_BADGES,
  RICH_MENU_VARIANTS,
  type RichMenuBadges,
  richMenuIds,
  richMenuKey,
} from "@/server/lib/line-richmenu";
import { publishedWhere } from "@/server/lib/news";
import {
  adminOnlyView,
  matchesAudience,
  specFromPost,
} from "@/server/lib/news-audience";
import { newsViewer } from "@/server/lib/news-visibility";
import type { CurrentUser } from "@/server/lib/session";

/**
 * Keeps each LINE friend's rich menu in step with what they have unread: a
 * red dot on the chat and news buttons (line-richmenu.ts variants). Run every
 * minute (src/lib/jobs, "line-menus") and right away when a
 * member links LINE, follows the account or changes language. The variant
 * last linked is stored (User.lineMenu), so LINE is only called when it
 * changes. Linking menus is free (not a message).
 */

/**
 * Unread chats and news for many members at once, counted like the app's
 * badges (chat-db.ts chatUnreadTotal, announcements.ts unreadCounts).
 */
export async function lineMenuBadges(
  users: CurrentUser[],
  now: Date = new Date(),
): Promise<Map<string, RichMenuBadges>> {
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return new Map();
  const [chatRows, posts] = await Promise.all([
    db.$queryRaw<{ userId: string }[]>`
      SELECT DISTINCT cm."userId"
      FROM "ChatMember" cm
      JOIN "ChatMessage" m ON m."groupId" = cm."groupId"
      WHERE cm."userId" = ANY(${ids}::text[])
        AND m."createdAt" > cm."lastReadAt"
        AND m."userId" <> cm."userId"
        AND m."deletedAt" IS NULL`,
    db.newsPost.findMany({
      where: publishedWhere(now),
      take: 1000,
      select: {
        id: true,
        publishedAt: true,
        audience: true,
        targetAudiences: true,
        targetRoles: true,
      },
    }),
  ]);
  const unreadChats = new Set(chatRows.map((r) => r.userId));

  // News posted since the member joined, in their audience (not only
  // visible because they're an admin).
  const wanted = new Map<string, string[]>();
  for (const user of users) {
    const viewer = await newsViewer(user);
    wanted.set(
      user.id,
      posts
        .filter((p) => {
          if (!p.publishedAt || p.publishedAt < user.createdAt) return false;
          const spec = specFromPost(p);
          return matchesAudience(spec, viewer) && !adminOnlyView(spec, viewer);
        })
        .map((p) => p.id),
    );
  }
  const postIds = [...new Set([...wanted.values()].flat())];
  const read = new Set(
    postIds.length
      ? (
          await db.newsRead.findMany({
            where: { userId: { in: ids }, postId: { in: postIds } },
            select: { userId: true, postId: true },
          })
        ).map((r) => `${r.userId}:${r.postId}`)
      : [],
  );

  return new Map(
    users.map((u) => [
      u.id,
      {
        chats: unreadChats.has(u.id),
        news: (wanted.get(u.id) ?? []).some((p) => !read.has(`${u.id}:${p}`)),
      },
    ]),
  );
}

/**
 * Run `fn` over `items`, a few at a time, starting none after `deadline`
 * (ms timestamp). Returns how many were left.
 */
async function eachLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  deadline?: number,
): Promise<number> {
  let next = 0;
  const open = () =>
    next < items.length && (deadline === undefined || Date.now() <= deadline);
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (open()) await fn(items[next++]);
    }),
  );
  return items.length - next;
}

export type LineMenuSyncResult = {
  checked: number;
  changed: number;
  failed: number;
  /** not tried because the deadline passed (next run) */
  remaining: number;
  /** false when the menus aren't installed (nothing linked) */
  installed: boolean;
};

/**
 * Link each LINE friend (all, or those matching `where`) to the variant for
 * their language and unread state. `force` relinks even when the stored
 * variant already matches (new menus, a newly linked LINE account).
 */
export async function syncLineMenus(
  opts: {
    where?: Prisma.UserWhereInput;
    force?: boolean;
    deadline?: number;
  } = {},
): Promise<LineMenuSyncResult> {
  const result = {
    checked: 0,
    changed: 0,
    failed: 0,
    remaining: 0,
    installed: true,
  };
  if (!lineConfigured()) return result;
  // Unfollowed: LINE can't link them; relink when they follow again.
  await db.user.updateMany({
    where: {
      ...opts.where,
      lineFollowing: false,
      lineMenu: { not: null },
    },
    data: { lineMenu: null },
  });
  const users = await db.user.findMany({
    where: { ...opts.where, lineUserId: { not: null }, lineFollowing: true },
    include: { roles: true },
  });
  result.checked = users.length;
  const badges = await lineMenuBadges(users);
  const due = users
    .map((user) => ({
      user,
      key: lineMenuKeyFor(user, badges.get(user.id) ?? NO_BADGES),
    }))
    .filter(({ user, key }) => opts.force || user.lineMenu !== key);
  if (due.length === 0) return result;

  // Not installed (or installed before the unread variants): wait for 管理 →
  // LINEメニュー → 更新する rather than link half the variants.
  const ids = await richMenuIds();
  if (
    !RICH_MENU_VARIANTS.every((v) => ids.has(richMenuKey(v.locale, v.badges)))
  )
    return { ...result, installed: false };
  result.remaining = await eachLimit(
    due,
    5,
    async ({ user, key }) => {
      const lineUserId = user.lineUserId as string;
      try {
        if (key === DEFAULT_RICH_MENU_KEY) {
          // The default menu: unlink rather than link it (fails harmlessly
          // when nothing is linked).
          await lineRequest("DELETE", `/user/${lineUserId}/richmenu`).catch(
            () => {},
          );
        } else {
          const id = ids.get(key);
          if (!id) throw new Error(`rich menu ${key} is not installed`);
          await lineRequest("POST", `/user/${lineUserId}/richmenu/${id}`);
        }
        await db.user.update({
          where: { id: user.id },
          data: { lineMenu: key },
        });
        result.changed++;
      } catch (e) {
        result.failed++;
        console.error(`[line-menu-sync] ${user.id} → ${key} failed`, e);
      }
    },
    opts.deadline,
  );
  return result;
}

/** One member's menu, now (best effort: never throws). */
export async function syncLineMenuFor(
  where: { id: string } | { lineUserId: string },
  force = true,
): Promise<void> {
  try {
    await syncLineMenus({ where, force });
  } catch (e) {
    console.error("[line-menu-sync] sync failed", e);
  }
}
