// From the website's server actions; here plain functions the API calls.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { NewsPollKind, NewsVote } from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import { isLive } from "@/server/lib/news";
import {
  adminOnlyView,
  matchesAudience,
  specFromPost,
} from "@/server/lib/news-audience";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_PREFIX,
  type AttachmentItem,
  isOpen,
  MAX_COMMENT_LENGTH,
  REACTIONS,
} from "@/server/lib/news-hub";
import { newsViewer } from "@/server/lib/news-visibility";
import {
  actionActive,
  actionAdmin,
  actionNewsAuthor,
  type CurrentUser,
} from "@/server/lib/session";
import { putPrivate } from "@/server/lib/storage";
import { safeFileName, sniffMatches } from "@/server/lib/verification/evidence";

export type HubResult = { ok: true } | { ok: false; error: HubError };
type HubError = "forbidden" | "closed" | "invalid" | "commentsOff";

const Id = z.string().min(1).max(64);

/** A published post the member may see (admins see all). */
async function openPost(postId: unknown) {
  const user = await actionActive().catch(() => null);
  const id = Id.safeParse(postId);
  if (!user || !id.success) return null;
  const post = await db.newsPost.findUnique({ where: { id: id.data } });
  if (!post || !isLive(post)) return null;
  const viewer = await newsViewer(user);
  const spec = specFromPost(post);
  if (!matchesAudience(spec, viewer)) return null;
  // Shown to an admin outside the audience: view only, no answers.
  if (adminOnlyView(spec, viewer)) return null;
  return { user, post };
}

function refresh(postId: string) {
  revalidatePath(`/[locale]/app/news/${postId}`, "page");
  revalidatePath("/[locale]/app/admin/news/[id]", "page");
}

/** 「確認しました」 (or take it back before the deadline). */
export async function confirmNewsAction(
  postId: string,
  on: boolean,
): Promise<HubResult> {
  const o = await openPost(postId);
  if (!o?.post.requireConfirm) return { ok: false, error: "forbidden" };
  if (!on && !isOpen(o.post)) return { ok: false, error: "closed" };
  if (on)
    await db.newsConfirm.upsert({
      where: { postId_userId: { postId: o.post.id, userId: o.user.id } },
      create: { postId: o.post.id, userId: o.user.id },
      update: {},
    });
  else
    await db.newsConfirm.deleteMany({
      where: { postId: o.post.id, userId: o.user.id },
    });
  refresh(o.post.id);
  return { ok: true };
}

const VoteSchema = z.object({
  pollId: Id,
  /** poll: chosen option ids; 日程調整: optionId → YES/MAYBE/NO */
  choices: z.record(z.string().max(64), z.enum(NewsVote)),
});

/** Answer a poll or 日程調整 (replaces the member's earlier answer). */
export async function votePollAction(
  postId: string,
  input: z.input<typeof VoteSchema>,
): Promise<HubResult> {
  const o = await openPost(postId);
  const parsed = VoteSchema.safeParse(input);
  if (!o || !parsed.success) return { ok: false, error: "invalid" };
  if (!isOpen(o.post)) return { ok: false, error: "closed" };
  const poll = await db.newsPoll.findFirst({
    where: { id: parsed.data.pollId, postId: o.post.id },
    select: {
      id: true,
      kind: true,
      multiple: true,
      options: { select: { id: true } },
    },
  });
  if (!poll) return { ok: false, error: "invalid" };
  const valid = new Set(poll.options.map((x) => x.id));
  const entries = Object.entries(parsed.data.choices).filter(([id]) =>
    valid.has(id),
  );
  const rows =
    poll.kind === NewsPollKind.POLL
      ? entries.filter(([, a]) => a === NewsVote.YES)
      : entries;
  if (poll.kind === NewsPollKind.POLL && !poll.multiple && rows.length > 1)
    return { ok: false, error: "invalid" };
  if (rows.length === 0) return { ok: false, error: "invalid" };

  await db.$transaction([
    db.newsPollVote.deleteMany({
      where: { pollId: poll.id, userId: o.user.id },
    }),
    db.newsPollVote.createMany({
      data: rows.map(([optionId, answer]) => ({
        optionId,
        pollId: poll.id,
        userId: o.user.id,
        answer,
      })),
    }),
  ]);
  refresh(o.post.id);
  return { ok: true };
}

export async function toggleReactionAction(
  postId: string,
  emoji: string,
): Promise<HubResult> {
  const o = await openPost(postId);
  if (!o || !(REACTIONS as readonly string[]).includes(emoji))
    return { ok: false, error: "invalid" };
  if (!o.post.allowComments) return { ok: false, error: "commentsOff" };
  const key = {
    postId_userId_emoji: { postId: o.post.id, userId: o.user.id, emoji },
  };
  const had = await db.newsReaction.findUnique({ where: key });
  if (had) await db.newsReaction.delete({ where: key });
  else
    await db.newsReaction.create({
      data: { postId: o.post.id, userId: o.user.id, emoji },
    });
  refresh(o.post.id);
  return { ok: true };
}

export async function addCommentAction(
  postId: string,
  body: string,
): Promise<HubResult> {
  const o = await openPost(postId);
  if (!o) return { ok: false, error: "forbidden" };
  if (!o.post.allowComments) return { ok: false, error: "commentsOff" };
  const text = String(body ?? "").trim();
  if (!text || text.length > MAX_COMMENT_LENGTH)
    return { ok: false, error: "invalid" };
  // Light flood control: at most 10 comments a minute per member.
  const recent = await db.newsComment.count({
    where: {
      userId: o.user.id,
      createdAt: { gt: new Date(Date.now() - 60_000) },
    },
  });
  if (recent >= 10) return { ok: false, error: "invalid" };
  await db.newsComment.create({
    data: { postId: o.post.id, userId: o.user.id, body: text },
  });
  refresh(o.post.id);
  return { ok: true };
}

/** Members delete their own comments; admins may delete any. */
export async function deleteCommentAction(
  commentId: string,
): Promise<HubResult> {
  const user = await actionActive().catch(() => null);
  const id = Id.safeParse(commentId);
  if (!user || !id.success) return { ok: false, error: "forbidden" };
  const c = await db.newsComment.findUnique({
    where: { id: id.data },
    select: { postId: true, userId: true, body: true },
  });
  if (!c || (c.userId !== user.id && !user.isAdmin))
    return { ok: false, error: "forbidden" };
  await db.newsComment.delete({ where: { id: id.data } });
  if (c.userId !== user.id)
    await audit(
      user.id,
      "news.comment_delete",
      {
        type: "NewsComment",
        id: id.data,
      },
      { postId: c.postId, author: c.userId, body: c.body.slice(0, 200) },
    );
  refresh(c.postId);
  return { ok: true };
}

/** Admin moderation: hide (or show again) a comment. */
export async function hideCommentAction(
  commentId: string,
  hide: boolean,
): Promise<HubResult> {
  const admin: CurrentUser | null = await actionAdmin().catch(() => null);
  const id = Id.safeParse(commentId);
  if (!admin || !id.success) return { ok: false, error: "forbidden" };
  const c = await db.newsComment.update({
    where: { id: id.data },
    data: hide
      ? { hiddenAt: new Date(), hiddenById: admin.id }
      : { hiddenAt: null, hiddenById: null },
    select: { postId: true },
  });
  await audit(
    admin.id,
    hide ? "news.comment_hide" : "news.comment_show",
    { type: "NewsComment", id: id.data },
    { postId: c.postId },
  );
  refresh(c.postId);
  return { ok: true };
}

export type UploadNewsFileResult =
  | { ok: true; item: AttachmentItem }
  | { ok: false; error: "forbidden" | "type" | "size" | "generic" };

/**
 * Attachment upload without Vercel Blob (local dev / e2e); with Blob the
 * browser uploads directly (/api/news/upload).
 */
export async function uploadNewsFileAction(
  fd: FormData,
): Promise<UploadNewsFileResult> {
  const author = await actionNewsAuthor().catch(() => null);
  if (!author) return { ok: false, error: "forbidden" };
  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, error: "generic" };
  if (file.size <= 0 || file.size > ATTACHMENT_MAX_BYTES)
    return { ok: false, error: "size" };
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffMatches(buf.subarray(0, 8), file.type))
    return { ok: false, error: "type" };
  try {
    const key = await putPrivate(
      `${ATTACHMENT_PREFIX}${randomUUID()}-${safeFileName(file.name)}`,
      buf,
      file.type,
    );
    return {
      ok: true,
      item: {
        key,
        fileName: file.name.slice(0, 200) || "file",
        mimeType: file.type as AttachmentItem["mimeType"],
        size: file.size,
      },
    };
  } catch (e) {
    console.error("[news-hub] upload failed", e);
    return { ok: false, error: "generic" };
  }
}
