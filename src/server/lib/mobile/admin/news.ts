import type {
  AdminNewsDetail,
  AdminNewsList,
  AdminNewsNotifyEstimate,
  AdminNewsResponses,
  AdminNewsRow,
} from "@contract/admin-news";
import type { NewsFormValues } from "@contract/compose";
import type { Prisma } from "@/server/generated/prisma/client";
import { NewsPollKind } from "@/server/generated/prisma/enums";
import { newsReaders, newsReadStats } from "@/server/lib/announcements";
import { getNewsApprover } from "@/server/lib/broadcasts";
import { db } from "@/server/lib/db";
import { displayName, localized, toJstLocalInput } from "@/server/lib/format";
import { staffOnly } from "@/server/lib/mobile/admin";
import { audienceSummary } from "@/server/lib/mobile/admin/events";
import { notificationOpens } from "@/server/lib/mobile/admin/notify";
import { type Locale, notFound } from "@/server/lib/mobile/http";
import {
  awaitingApproval,
  newsStatus,
  targetedRecipients,
} from "@/server/lib/news";
import { specFromPost } from "@/server/lib/news-audience";
import {
  asksAnything,
  bestCandidates,
  tally,
  type Vote,
} from "@/server/lib/news-hub";
import { hubFormValues, responses } from "@/server/lib/news-hub-db";
import { estimateLinePushes } from "@/server/lib/notify";
import { membersWithPush } from "@/server/lib/push/devices";
import { actionNewsAuthor, type CurrentUser } from "@/server/lib/session";
import { signedFileUrl } from "@/server/lib/storage";

/**
 * Admin mode → ニュース (the website's /app/admin/news pages). The pages'
 * checks: the admin layout's requireStaff() (staffOnly), then
 * requireNewsAuthor() (actionNewsAuthor: 403 for non-authors), then for one
 * post: admins and its author may edit it, and 同窓会委員 may open another
 * 同窓会委員's post to approve it; anyone else gets 404. Mutations are the
 * website's server actions (src/server/app/actions/admin-content.ts), which
 * check again.
 */

const PAGE_SIZE = 30;

/** requireStaff() + requireNewsAuthor(), as the pages. */
async function newsAuthor(user: CurrentUser) {
  await staffOnly(user);
  return actionNewsAuthor();
}

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

/** Admins see every post; other authors their own (and 同窓会委員 the ones they may approve). */
export async function adminNewsList(
  user: CurrentUser,
  opts: { page: number; archived: boolean },
  locale: Locale,
): Promise<AdminNewsList> {
  await newsAuthor(user);
  const { page, archived } = opts;
  const mine: Prisma.NewsPostWhereInput = user.isAdmin
    ? {}
    : (await getNewsApprover(user))
      ? { OR: [{ createdById: user.id }, { approvalRequired: true }] }
      : { createdById: user.id };
  const archivedCount = await db.newsPost.count({
    where: { ...mine, archivedAt: { not: null } },
  });
  // Drafts (publishedAt null) first, then newest publish date.
  const rows = await db.newsPost.findMany({
    where: { ...mine, archivedAt: archived ? { not: null } : null },
    orderBy: [
      { publishedAt: { sort: "desc", nulls: "first" } },
      { createdAt: "desc" },
    ],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      titleJa: true,
      titleEn: true,
      publishedAt: true,
      notifiedAt: true,
      notifyOnPublish: true,
      pinned: true,
      targetRoles: true,
      targetAudiences: true,
      audience: true,
      approvalRequired: true,
      approvedAt: true,
    },
  });
  const posts = rows.slice(0, PAGE_SIZE);
  // Read counts only for live posts; drafts and scheduled ones show none.
  const stats = await newsReadStats(
    posts.filter((p) => newsStatus(p) === "published"),
  );
  return {
    isAdmin: user.isAdmin,
    archived,
    archivedCount,
    page,
    hasNext: rows.length > PAGE_SIZE,
    posts: posts.map((p): AdminNewsRow => {
      const title = localized(p.titleJa, p.titleEn, locale);
      return {
        id: p.id,
        title: title.text,
        titleFallback: title.fallback,
        status: newsStatus(p),
        awaitingApproval: awaitingApproval(p),
        notified: p.notifiedAt !== null,
        pinned: p.pinned,
        noNotify: !p.notifyOnPublish && !p.notifiedAt,
        publishedAt: iso(p.publishedAt),
        audience: audienceSummary(specFromPost(p)),
        reads: stats.get(p.id) ?? null,
      };
    }),
  };
}

/** The post, if the member may open it here (else 404). */
async function openPost(user: CurrentUser, id: string) {
  const { scope } = await newsAuthor(user);
  if (!id || id.length > 64) throw notFound();
  const post = await db.newsPost.findUnique({ where: { id } });
  if (!post) throw notFound();
  // Teachers, 同窓会委員 and 学年代表 manage only their own posts; other
  // 同窓会委員 may open a 同窓会委員's post to approve it (view only).
  const canEdit = user.isAdmin || post.createdById === user.id;
  const approver = await getNewsApprover(user);
  if (!canEdit && !(approver && post.approvalRequired)) throw notFound();
  return { post, canEdit, approver, scope };
}

type Post = Awaited<ReturnType<typeof openPost>>["post"];

/** 回答状況 (the website's NewsResponsesCard); null when it asks nothing. */
async function responsesOf(
  post: Post,
  locale: Locale,
): Promise<AdminNewsResponses | null> {
  const { asks, members, pending } = await responses(post);
  if (!asksAnything(asks)) return null;
  const [polls, confirms, pendingUsers] = await Promise.all([
    db.newsPoll.findMany({
      where: { postId: post.id },
      orderBy: { kind: "asc" },
      select: {
        id: true,
        kind: true,
        question: true,
        options: {
          orderBy: { position: "asc" },
          select: { id: true, label: true, startsAt: true },
        },
        votes: {
          select: {
            optionId: true,
            answer: true,
            user: { select: { id: true, nameRomaji: true, nameKanji: true } },
          },
        },
      },
    }),
    post.requireConfirm
      ? db.newsConfirm.findMany({
          where: { postId: post.id },
          orderBy: { confirmedAt: "asc" },
          select: {
            confirmedAt: true,
            user: { select: { id: true, nameRomaji: true, nameKanji: true } },
          },
        })
      : null,
    db.user.findMany({
      where: { id: { in: pending.map((m) => m.id) } },
      orderBy: { nameRomaji: "asc" },
      select: { id: true, nameRomaji: true, nameKanji: true },
    }),
  ]);
  return {
    done: members.length - pending.length,
    total: members.length,
    deadline: iso(post.deadline),
    remindedAt: iso(post.remindedAt),
    pending: pendingUsers.map((m) => ({
      userId: m.id,
      name: displayName(m, locale),
      at: null,
    })),
    confirmed:
      confirms?.map((c) => ({
        userId: c.user.id,
        name: displayName(c.user, locale),
        at: c.confirmedAt.toISOString(),
      })) ?? null,
    polls: polls.map((p) => {
      const votes = p.votes as {
        optionId: string;
        answer: Vote;
        user: (typeof p.votes)[number]["user"];
      }[];
      const counts = tally(
        p.options.map((o) => o.id),
        votes,
      );
      const best =
        p.kind === NewsPollKind.SCHEDULE
          ? new Set(bestCandidates(counts))
          : new Set<string>();
      return {
        id: p.id,
        kind: p.kind === NewsPollKind.SCHEDULE ? "SCHEDULE" : "POLL",
        question: p.question,
        voters: new Set(votes.map((v) => v.user.id)).size,
        options: p.options.map((o) => {
          const c = counts.get(o.id) ?? { YES: 0, MAYBE: 0, NO: 0 };
          return {
            id: o.id,
            label: o.label,
            startsAt: iso(o.startsAt),
            best: best.has(o.id),
            yes: c.YES,
            maybe: c.MAYBE,
            no: c.NO,
            voters: votes
              .filter((v) => v.optionId === o.id)
              .map((v) => ({
                name: displayName(v.user, locale),
                answer: v.answer,
              })),
          };
        }),
      };
    }),
  };
}

/** One post as the website's admin page shows it. */
export async function adminNewsDetail(
  user: CurrentUser,
  id: string,
  locale: Locale,
): Promise<AdminNewsDetail> {
  const { post, canEdit, approver } = await openPost(user, id);
  const pending = awaitingApproval(post);
  const status = newsStatus(post);
  const audience = specFromPost(post);
  const published = status === "published";
  const [members, hub, approvedBy] = await Promise.all([
    audience.userIds.length
      ? db.user.findMany({
          where: { id: { in: audience.userIds } },
          select: { id: true, nameRomaji: true, nameKanji: true },
        })
      : [],
    hubFormValues(post),
    post.approvedById
      ? db.user.findUnique({
          where: { id: post.approvedById },
          select: { nameRomaji: true, nameKanji: true },
        })
      : null,
  ]);
  const asks = post.requireConfirm || hub.poll || hub.schedule;
  const [responsesCard, readStats, readers, opens] = await Promise.all([
    published ? responsesOf(post, locale) : null,
    published ? newsReadStats([post]) : null,
    published ? newsReaders(post.id) : null,
    notificationOpens(["NEWS", "NEWS_REMINDER"], post.id, locale),
  ]);
  const cover = post.coverUrl ? signedFileUrl(post.coverUrl) : null;
  const title = localized(post.titleJa, post.titleEn, locale);

  const values: NewsFormValues | null = canEdit
    ? {
        id: post.id,
        titleJa: post.titleJa ?? "",
        titleEn: post.titleEn ?? "",
        bodyJa: post.bodyJa ?? "",
        bodyEn: post.bodyEn ?? "",
        status,
        sendAt:
          status === "scheduled" && post.publishedAt
            ? toJstLocalInput(post.publishedAt)
            : "",
        notifyOnPublish: post.notifyOnPublish,
        pinned: post.pinned,
        audience,
        audienceMembers: members.map((m) => ({
          id: m.id,
          name: m.nameRomaji ?? m.nameKanji ?? "—",
          kanji: m.nameRomaji ? m.nameKanji : null,
        })),
        coverPreviewUrl: cover,
        hub: {
          ...hub,
          attachments: hub.attachments.map((a) => ({
            id: a.id,
            key: "",
            fileName: a.fileName,
            mimeType: a.mimeType,
            size: a.size,
          })),
        },
      }
    : null;

  return {
    id: post.id,
    title: title.text,
    status,
    awaitingApproval: pending,
    notified: post.notifiedAt !== null,
    pinned: post.pinned,
    archived: post.archivedAt !== null,
    canEdit,
    viewAsMember: canEdit && published && !post.archivedAt,
    view: {
      titleJa: post.titleJa,
      titleEn: post.titleEn,
      bodyJa: post.bodyJa,
      bodyEn: post.bodyEn,
      publishedAt: iso(post.publishedAt),
      notifyOnPublish: post.notifyOnPublish,
      pinned: post.pinned,
      requireConfirm: post.requireConfirm,
      allowComments: post.allowComments,
      deadline: iso(post.deadline),
      audience: audienceSummary(audience),
      poll: hub.poll?.question ?? null,
      scheduleCount: hub.schedule ? hub.schedule.options.length : null,
      attachments: hub.attachments.map((a) => a.fileName),
      cover,
    },
    approval: post.approvalRequired
      ? {
          approvedAt: iso(post.approvedAt),
          approvedBy: approvedBy
            ? (approvedBy.nameKanji ?? approvedBy.nameRomaji ?? "—")
            : null,
          canApprove: approver && post.createdById !== user.id,
        }
      : null,
    notify:
      canEdit && !post.archivedAt && !pending
        ? {
            notifiedAt: iso(post.notifiedAt),
            publishedAt: iso(post.publishedAt),
          }
        : null,
    close:
      published && asks
        ? { closedAt: iso(post.closedAt), deadline: iso(post.deadline) }
        : null,
    responses: responsesCard,
    reads:
      readStats && readers
        ? {
            ...(readStats.get(post.id) ?? { read: 0, audience: 0 }),
            readers: readers.map((r) => ({
              userId: r.user.id,
              name: displayName(r.user, locale),
              at: r.readAt.toISOString(),
            })),
          }
        : null,
    opens,
    values,
  };
}

/**
 * 通知内容の確認 (the website's NotifyPanel with ?notify=1): recipients and
 * how many LINE messages, emails and app notifications it takes.
 */
export async function adminNewsNotifyEstimate(
  user: CurrentUser,
  id: string,
): Promise<AdminNewsNotifyEstimate> {
  const { post, canEdit } = await openPost(user, id);
  // The panel is only there for editors of a live, approved, unsent post.
  if (!canEdit || post.archivedAt || awaitingApproval(post) || post.notifiedAt)
    throw notFound();
  const users = await targetedRecipients(post);
  const est = estimateLinePushes(
    users,
    "NEWS",
    await membersWithPush(users.map((u) => u.id)),
  );
  return {
    publishNow: newsStatus(post) !== "published",
    recipients: users.length,
    ...est,
    unreachable: users.length - est.line - est.email - est.app,
  };
}
