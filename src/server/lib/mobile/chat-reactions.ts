import type {
  ChatMessage,
  ChatReactionSummary,
  ChatReactionsResult,
} from "@contract/chat";
import { z } from "zod";
import { chatReadStateAction } from "@/server/app/actions/chat";
import { ChatGroupKind } from "@/server/generated/prisma/enums";
import { directStopReason } from "@/server/lib/chat-db";
import { isReactionEmoji } from "@/server/lib/chat-emoji";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { ApiError, type Locale, notFound } from "@/server/lib/mobile/http";
import { broadcast, channelTopic } from "@/server/lib/realtime";
import type { CurrentUser } from "@/server/lib/session";

/**
 * Emoji reactions on chat messages (app only; any emoji). Whoever can open
 * the talk may react — the same rule as reading it (chatReadStateAction:
 * members, and admins for group chats) — except in a stopped 1:1 talk and
 * on deleted messages. No notifications: other open rooms get a "reaction"
 * signal and reload that message's reactions.
 *
 * The ChatReaction table arrives with a migration; until it is deployed,
 * reading answers "no reactions" and toggling 503 `unavailable`, so chat
 * itself keeps working.
 */

/** Different emoji one message can carry. */
export const MAX_REACTION_EMOJI = 20;
/** Names listed per emoji (the 「リアクションした人」 sheet). */
const MAX_NAMES = 10;

/**
 * The table isn't there yet: Prisma's P2021, or Postgres' 42P01 / "relation
 * … does not exist" through the driver adapter.
 */
function missingTable(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown; cause?: unknown };
  if (err?.code === "P2021" || err?.code === "42P01") return true;
  const text = `${String(err?.message ?? "")} ${String(
    (err?.cause as { message?: unknown } | undefined)?.message ?? "",
  )}`;
  return /ChatReaction/i.test(text) && /does not exist/i.test(text);
}

export const ReactionBody = z.object({
  emoji: z.string().max(64),
});

type Row = {
  messageId: string;
  userId: string;
  emoji: string;
  user: { nameRomaji: string | null; nameKanji: string | null };
};

/** Every reaction of these messages, oldest first — one query. */
async function loadRows(messageIds: string[]): Promise<Row[]> {
  if (!messageIds.length) return [];
  try {
    return await db.chatReaction.findMany({
      where: { messageId: { in: messageIds } },
      orderBy: { createdAt: "asc" },
      select: {
        messageId: true,
        userId: true,
        emoji: true,
        user: { select: { nameRomaji: true, nameKanji: true } },
      },
    });
  } catch (e) {
    if (missingTable(e)) return [];
    throw e;
  }
}

function summarize(
  rows: Row[],
  meId: string,
  locale: Locale,
): Map<string, ChatReactionSummary[]> {
  const out = new Map<string, Map<string, ChatReactionSummary>>();
  for (const r of rows) {
    const byEmoji = out.get(r.messageId) ?? new Map();
    out.set(r.messageId, byEmoji);
    let s = byEmoji.get(r.emoji);
    if (!s) {
      s = { emoji: r.emoji, count: 0, mine: false, names: [] };
      byEmoji.set(r.emoji, s);
    }
    s.count++;
    if (r.userId === meId) s.mine = true;
    if (s.names.length < MAX_NAMES) s.names.push(displayName(r.user, locale));
  }
  // Maps keep insertion order: by each emoji's first reaction.
  return new Map([...out].map(([id, m]) => [id, [...m.values()]]));
}

/** The messages with their reactions (deleted ones: none). */
export async function withReactions<M extends ChatMessage>(
  messages: M[],
  meId: string,
  locale: Locale,
): Promise<M[]> {
  const ids = messages.filter((m) => !m.deleted).map((m) => m.id);
  const byMessage = summarize(await loadRows(ids), meId, locale);
  return messages.map((m) => ({
    ...m,
    reactions: m.deleted ? [] : (byMessage.get(m.id) ?? []),
  }));
}

async function reactionsOf(
  messageId: string,
  meId: string,
  locale: Locale,
): Promise<ChatReactionsResult> {
  const byMessage = summarize(await loadRows([messageId]), meId, locale);
  return { reactions: byMessage.get(messageId) ?? [] };
}

/** A message of a talk the member can open (404 otherwise). */
async function openMessage(groupId: string, messageId: string) {
  if (!(await chatReadStateAction(groupId))) throw notFound();
  const m = await db.chatMessage.findUnique({
    where: { id: messageId },
    select: { groupId: true, deletedAt: true },
  });
  if (!m || m.groupId !== groupId) throw notFound();
  return m;
}

/** GET …/messages/:messageId/reactions (after a "reaction" signal). */
export async function messageReactions(
  user: CurrentUser,
  locale: Locale,
  groupId: string,
  messageId: string,
): Promise<ChatReactionsResult> {
  const m = await openMessage(groupId, messageId);
  if (m.deletedAt) return { reactions: [] };
  return reactionsOf(messageId, user.id, locale);
}

/** A 1:1 talk that has stopped (block, member types): no reactions either. */
async function directStopped(groupId: string, meId: string) {
  const g = await db.chatGroup.findUnique({
    where: { id: groupId },
    select: { kind: true },
  });
  if (g?.kind !== ChatGroupKind.DIRECT) return false;
  const other = await db.chatMember.findFirst({
    where: { groupId, userId: { not: meId } },
    select: { userId: true },
  });
  return !other || (await directStopReason(meId, other.userId)) !== null;
}

/** POST …/messages/:messageId/reactions: add or remove the member's emoji. */
export async function toggleReaction(
  user: CurrentUser,
  locale: Locale,
  groupId: string,
  messageId: string,
  { emoji: raw }: z.infer<typeof ReactionBody>,
): Promise<ChatReactionsResult> {
  const emoji = raw.trim();
  if (!isReactionEmoji(emoji)) throw new ApiError(400, "invalid");
  const m = await openMessage(groupId, messageId);
  if (m.deletedAt) throw new ApiError(400, "deleted");
  if (await directStopped(groupId, user.id))
    throw new ApiError(403, "forbidden");

  const key = { messageId_userId_emoji: { messageId, userId: user.id, emoji } };
  try {
    const had = await db.chatReaction.findUnique({
      where: key,
      select: { emoji: true },
    });
    if (had)
      await db.chatReaction.deleteMany({ where: key.messageId_userId_emoji });
    else {
      const used = await db.chatReaction.findMany({
        where: { messageId },
        distinct: ["emoji"],
        select: { emoji: true },
      });
      if (
        !used.some((u) => u.emoji === emoji) &&
        used.length >= MAX_REACTION_EMOJI
      )
        throw new ApiError(400, "too_many");
      // A double tap racing itself: the row is there either way.
      await db.chatReaction.createMany({
        data: [{ messageId, userId: user.id, emoji }],
        skipDuplicates: true,
      });
    }
  } catch (e) {
    if (missingTable(e)) throw new ApiError(503, "unavailable");
    throw e;
  }

  // A signal only; open rooms reload this message's reactions.
  await broadcast([
    {
      topic: channelTopic("chat", groupId),
      event: "reaction",
      payload: { id: messageId },
    },
  ]);
  return reactionsOf(messageId, user.id, locale);
}
