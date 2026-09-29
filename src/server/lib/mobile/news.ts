import type {
  NewsDetail,
  NewsHubOk,
  NewsList,
  NewsSummary,
  NewsVote,
} from "@contract/news";
import type { HubResult } from "@/server/app/actions/news-hub";
import { NewsPollKind } from "@/server/generated/prisma/enums";
import { markNewsRead, readNewsIds } from "@/server/lib/announcements";
import { getNewsScope } from "@/server/lib/broadcasts";
import { db } from "@/server/lib/db";
import { localized } from "@/server/lib/format";
import { markdownToPlain } from "@/server/lib/markdown";
import { ApiError, type Locale, notFound } from "@/server/lib/mobile/http";
import { iso } from "@/server/lib/mobile/present";
import { isLive, NEWS_PAGE_SIZE } from "@/server/lib/news";
import {
  adminOnlyView,
  matchesAudience,
  specFromPost,
} from "@/server/lib/news-audience";
import {
  bestCandidates,
  isOpen,
  MAX_COMMENT_LENGTH,
} from "@/server/lib/news-hub";
import { awaitingResponse, loadHub } from "@/server/lib/news-hub-db";
import { newsViewer, visibleNews } from "@/server/lib/news-visibility";
import { senderLabel, senderLabels } from "@/server/lib/sender";
import type { CurrentUser } from "@/server/lib/session";
import { signedFileUrl } from "@/server/lib/storage";

/**
 * ニュース for the native app: the same queries and rules as the website's
 * /app/news (src/app/[locale]/app/(member)/news/page.tsx) and
 * /app/news/[id] pages. Visibility comes from news-visibility /
 * news-audience; answers go through the website's server actions
 * (src/app/actions/news-hub.ts).
 */

/** Columns a news card needs (as the website's list and dashboard). */
export const NEWS_CARD_SELECT = {
  id: true,
  titleJa: true,
  titleEn: true,
  bodyJa: true,
  bodyEn: true,
  pinned: true,
  publishedAt: true,
  requireConfirm: true,
  deadline: true,
  closedAt: true,
  senderRole: true,
  audience: true,
  targetAudiences: true,
  targetRoles: true,
} as const;

type CardRow = {
  id: string;
  titleJa: string | null;
  titleEn: string | null;
  bodyJa: string | null;
  bodyEn: string | null;
  pinned: boolean;
  publishedAt: Date | null;
};

export function newsSummary(
  p: CardRow,
  locale: Locale,
  flags: {
    sender: string | undefined;
    unread: boolean;
    needsAnswer: boolean;
    adminView: boolean;
    excerpt: boolean;
  },
): NewsSummary {
  const title = localized(p.titleJa, p.titleEn, locale);
  const excerpt = flags.excerpt
    ? markdownToPlain(localized(p.bodyJa, p.bodyEn, locale).text, 140)
    : "";
  return {
    id: p.id,
    title: title.text,
    titleFallback: title.fallback,
    excerpt: excerpt || null,
    pinned: p.pinned,
    publishedAt: iso(p.publishedAt),
    sender: flags.sender ?? "",
    unread: flags.unread,
    needsAnswer: flags.needsAnswer,
    adminView: flags.adminView,
  };
}

/** One page of the ニュース list (the website's NewsTab). */
export async function listNews(
  user: CurrentUser,
  page: number,
  locale: Locale,
): Promise<NewsList> {
  const [visible, scope] = await Promise.all([
    visibleNews(user),
    getNewsScope(user),
  ]);
  // One extra id tells whether there is a next page.
  const pageIds = visible
    .slice((page - 1) * NEWS_PAGE_SIZE, page * NEWS_PAGE_SIZE + 1)
    .map((p) => p.id);
  const found = await db.newsPost.findMany({
    where: { id: { in: pageIds } },
    select: NEWS_CARD_SELECT,
  });
  const rows = pageIds
    .map((id) => found.find((p) => p.id === id))
    .filter((p): p is (typeof found)[number] => Boolean(p));
  const hasNext = rows.length > NEWS_PAGE_SIZE;
  const posts = rows.slice(0, NEWS_PAGE_SIZE);
  // Shown only because the member is an admin: view only (no unread, no answer).
  const adminView = new Set(
    visible.filter((p) => p.adminView).map((p) => p.id),
  );
  const [read, awaiting, senders] = await Promise.all([
    readNewsIds(
      user.id,
      posts.map((p) => p.id),
    ),
    awaitingResponse(
      user.id,
      posts.filter((p) => !adminView.has(p.id)),
    ),
    senderLabels(posts, locale),
  ]);
  // Same rule as the unread count: posts from before the member joined
  // are never "unread".
  const isUnread = (p: (typeof posts)[number]) =>
    !adminView.has(p.id) &&
    !read.has(p.id) &&
    !!p.publishedAt &&
    p.publishedAt >= user.createdAt;
  return {
    page,
    hasNext,
    canCreate: scope !== null,
    posts: posts.map((p) =>
      newsSummary(p, locale, {
        sender: senders.get(p.id),
        unread: isUnread(p),
        needsAnswer: awaiting.has(p.id),
        adminView: adminView.has(p.id),
        excerpt: true,
      }),
    ),
  };
}

/**
 * A published post the member may see, as the website's detail page loads
 * it: live, and aimed at them — or shown to an admin outside the audience
 * (adminView: view only).
 */
async function visiblePost(user: CurrentUser, id: string) {
  if (!id || id.length > 64) return null;
  const post = await db.newsPost.findUnique({ where: { id } });
  if (!post || !isLive(post)) return null;
  const viewer = await newsViewer(user);
  const spec = specFromPost(post);
  if (!matchesAudience(spec, viewer)) return null;
  return { ...post, adminView: adminOnlyView(spec, viewer) };
}

/** The post page: body, attachments and the hub. Records the read. */
export async function newsDetail(
  user: CurrentUser,
  id: string,
  locale: Locale,
): Promise<NewsDetail> {
  const post = await visiblePost(user, id);
  if (!post?.publishedAt) throw notFound();
  // Published and aimed at this member: record the read — not for an admin
  // outside the audience (view only).
  const adminView = post.adminView;
  if (!adminView) await markNewsRead(user.id, post.id);

  const title = localized(post.titleJa, post.titleEn, locale);
  const body = localized(post.bodyJa, post.bodyEn, locale);
  // Authorized above (targeted + published) before issuing signed URLs.
  const cover = post.coverUrl ? signedFileUrl(post.coverUrl) : null;
  const [hub, sender] = await Promise.all([
    loadHub(post, user),
    senderLabel(post, locale),
  ]);
  // Admins outside the audience see the forms and results, but can't answer.
  const open = isOpen(post) && !adminView;

  return {
    id: post.id,
    adminView,
    pinned: post.pinned,
    publishedAt: post.publishedAt.toISOString(),
    sender,
    title: title.text,
    titleFallback: title.fallback,
    body: body.text,
    bodyFallback: body.fallback,
    cover,
    deadline: iso(post.deadline),
    closedAt: iso(post.closedAt),
    open,
    requireConfirm: post.requireConfirm,
    confirmedAt: iso(hub.confirmedAt),
    confirmCount: hub.confirmCount,
    polls: hub.polls.map((p) => {
      const best = new Set(
        p.kind === NewsPollKind.SCHEDULE
          ? bestCandidates(new Map(p.options.map((o) => [o.id, o.counts])))
          : [],
      );
      return {
        id: p.id,
        kind: p.kind,
        question: p.question,
        multiple: p.multiple,
        voters: p.voters,
        options: p.options.map((o) => ({
          id: o.id,
          label: o.label,
          startsAt: o.startsAt,
          counts: o.counts,
          mine: o.mine,
          best: best.has(o.id),
          names: o.names.map((n) => ({
            name: n.name,
            answer: n.answer as NewsVote,
          })),
        })),
      };
    }),
    attachments: hub.attachments,
    allowComments: post.allowComments,
    reactions: hub.reactions,
    comments: hub.comments,
    isAdmin: user.isAdmin,
    maxCommentLength: MAX_COMMENT_LENGTH,
  };
}

type HubError = Extract<HubResult, { ok: false }>["error"];

const HUB_STATUS: Record<HubError, number> = {
  forbidden: 403,
  invalid: 400,
  closed: 409,
  commentsOff: 409,
};

/** A hub action's result as an API response (errors keep their code). */
export function hubResponse(result: HubResult): NewsHubOk {
  if (result.ok) return { ok: true };
  throw new ApiError(HUB_STATUS[result.error] ?? 400, result.error);
}

/** 404 unless the comment belongs to the post in the URL. */
export async function requireCommentOnPost(
  postId: string,
  commentId: string,
): Promise<void> {
  const c = await db.newsComment.findUnique({
    where: { id: commentId },
    select: { postId: true },
  });
  if (!c || c.postId !== postId) throw notFound();
}
