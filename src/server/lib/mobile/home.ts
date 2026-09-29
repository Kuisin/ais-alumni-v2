import type { Home, HomeLineBanner, HomeNews } from "@contract/home";
import {
  AccountState,
  FamilyLinkInitiator,
  FollowStatus,
  VerificationStatus,
} from "@/server/generated/prisma/enums";
import { readNewsIds, unreadCounts } from "@/server/lib/announcements";
import { eventApprovedWhere } from "@/server/lib/approval";
import { db } from "@/server/lib/db";
import { displayName, localized } from "@/server/lib/format";
import { lineAddFriendUrl } from "@/server/lib/line-link";
import type { Locale } from "@/server/lib/mobile/http";
import { NEWS_CARD_SELECT, newsSummary } from "@/server/lib/mobile/news";
import { awaitingResponse } from "@/server/lib/news-hub-db";
import { filterByAudience, visibleNews } from "@/server/lib/news-visibility";
import { senderLabels } from "@/server/lib/sender";
import type { CurrentUser } from "@/server/lib/session";
import { setupProgress } from "@/server/lib/setup";
import { loadSetupChecklist } from "@/server/lib/setup-db";
import { ssoReady } from "@/server/lib/sso";

/**
 * ホーム for the native app: the same data as the website's dashboard
 * (src/app/[locale]/app/(member)/dashboard/page.tsx) — to-dos, the setup
 * checklist or the LINE banner, up to 3 upcoming events and 3 news posts.
 */

const NAME = { nameRomaji: true, nameKanji: true } as const;

/** As src/components/line/line-banner.tsx: "Not now" hides it for 30 days. */
const LINE_BANNER_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Whether the dashboard's LINE banner shows, and what it offers — the
 * conditions of src/components/line/line-banner.tsx.
 */
export function lineBanner(
  user: CurrentUser,
  now: number = Date.now(),
): HomeLineBanner | null {
  if (user.state !== AccountState.ACTIVE) return null;
  if (user.lineUserId && user.lineFollowing) return null;
  if (!user.lineUserId && !ssoReady("line")) return null;
  if (
    user.lineBannerDismissedAt &&
    now - user.lineBannerDismissedAt.getTime() < LINE_BANNER_DISMISS_MS
  )
    return null;
  const addFriendUrl = lineAddFriendUrl();
  // Linked but not following, and no OA id configured: nothing to offer.
  if (user.lineUserId && !addFriendUrl) return null;
  return { linked: Boolean(user.lineUserId), addFriendUrl };
}

export async function homeFor(
  user: CurrentUser,
  locale: Locale,
): Promise<Home> {
  const now = new Date();
  const [events, news, followRequests, vouches, familyLinks, unread] =
    await Promise.all([
      db.event
        .findMany({
          where: {
            OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }],
            AND: [eventApprovedWhere],
          },
          orderBy: { startsAt: "asc" },
          take: 200,
          select: {
            audience: true,
            targetAudiences: true,
            targetRoles: true,
            id: true,
            titleJa: true,
            titleEn: true,
            startsAt: true,
            location: true,
            senderRole: true,
            rsvps: { where: { userId: user.id }, select: { answer: true } },
          },
        })
        // Same audience conditions as ニュース.
        .then(async (rows) => (await filterByAudience(user, rows)).slice(0, 3)),
      visibleNews(user, now).then((v) =>
        db.newsPost.findMany({
          // The member's own news (not posts shown only to admins).
          where: {
            id: {
              in: v
                .filter((p) => !p.adminView)
                .slice(0, 3)
                .map((p) => p.id),
            },
          },
          orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
          select: NEWS_CARD_SELECT,
        }),
      ),
      db.follow.count({
        where: { followeeId: user.id, status: FollowStatus.REQUESTED },
      }),
      // Vouch requests still waiting for my answer on undecided applications.
      db.vouch.findMany({
        where: {
          voucherId: user.id,
          answer: null,
          request: {
            status: {
              in: [VerificationStatus.PENDING, VerificationStatus.NEEDS_INFO],
            },
          },
        },
        orderBy: { askedAt: "asc" },
        select: { id: true, request: { select: { user: { select: NAME } } } },
      }),
      // Family links initiated by the other side that I have to confirm.
      db.familyLink.findMany({
        where: {
          confirmedAt: null,
          OR: [
            { initiatedBy: FamilyLinkInitiator.PARENT, childId: user.id },
            { initiatedBy: FamilyLinkInitiator.CHILD, parentId: user.id },
          ],
        },
        select: {
          id: true,
          initiatedBy: true,
          parent: { select: NAME },
          child: { select: NAME },
        },
      }),
      unreadCounts(user),
    ]);
  const [readNews, awaiting, senders, setup] = await Promise.all([
    readNewsIds(
      user.id,
      news.map((p) => p.id),
    ),
    awaitingResponse(user.id, news),
    senderLabels([...news, ...events], locale),
    loadSetupChecklist(user),
  ]);
  const progress = setupProgress(setup);

  return {
    todo: {
      followRequests,
      vouches: vouches.map((v) => ({
        id: v.id,
        name: displayName(v.request.user, locale),
      })),
      family: familyLinks.map((l) => {
        const other =
          l.initiatedBy === FamilyLinkInitiator.PARENT ? l.parent : l.child;
        return {
          id: l.id,
          initiatedBy: l.initiatedBy,
          name: other ? displayName(other, locale) : "—",
        };
      }),
    },
    setup: {
      items: setup.map((i) => ({
        key: i.key,
        done: i.done,
        href: i.href,
        optional: Boolean(i.optional),
        recommended: Boolean(i.recommended),
      })),
      ...progress,
    },
    // Waiting on me first; the setup checklist, or once it's done the banner.
    line: progress.complete ? lineBanner(user) : null,
    unreadMessages: unread.messages,
    events: events.map((e) => {
      const title = localized(e.titleJa, e.titleEn, locale);
      return {
        id: e.id,
        title: title.text,
        titleFallback: title.fallback,
        startsAt: e.startsAt.toISOString(),
        location: e.location,
        sender: senders.get(e.id) ?? "",
        myAnswer: e.rsvps[0]?.answer ?? null,
      };
    }),
    news: news.map((p): HomeNews => {
      const s = newsSummary(p, locale, {
        sender: senders.get(p.id),
        needsAnswer: awaiting.has(p.id),
        unread:
          !readNews.has(p.id) &&
          !!p.publishedAt &&
          p.publishedAt >= user.createdAt,
        adminView: false,
        excerpt: false,
      });
      return {
        id: s.id,
        title: s.title,
        titleFallback: s.titleFallback,
        pinned: s.pinned,
        publishedAt: s.publishedAt,
        sender: s.sender,
        unread: s.unread,
        needsAnswer: s.needsAnswer,
      };
    }),
  };
}
