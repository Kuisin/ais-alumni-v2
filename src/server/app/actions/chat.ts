// From the website's server actions; here plain functions the API calls.

import { after } from "next/server";
import { z } from "zod";
import {
  ChatGroupKind,
  PositionKey,
  RoleKey,
} from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import {
  AVATAR_SELECT,
  type Connections,
  loadConnections,
  photoFor,
} from "@/server/lib/avatar";
import {
  CHAT_PAGE_SIZE,
  directKey,
  MAX_CHAT_MESSAGE,
  MAX_MENTIONS,
} from "@/server/lib/chat";
import {
  type DirectDenial,
  type DirectStop,
  directChatDenial,
  directStopReason,
  openDirectChat,
} from "@/server/lib/chat-db";
import { db } from "@/server/lib/db";
import { pushChatMessage } from "@/server/lib/push/chat";
import { broadcast, channelTopic, realtimePublic } from "@/server/lib/realtime";
import { actionActive, type CurrentUser } from "@/server/lib/session";

export type ChatMessageView = {
  id: string;
  userId: string;
  name: string;
  /** signed photo URL, or null (initials) */
  avatar: string | null;
  /** 第N期 of the sender (students / graduates), shown next to the name */
  cohort: number | null;
  /** the sender is a 学年代表 */
  rep: boolean;
  body: string;
  createdAt: string;
  deleted: boolean;
  /** members mentioned with @name */
  mentionUserIds: string[];
  /** @全員 */
  mentionAll: boolean;
};

const Id = z.string().min(1).max(64);

const STUDENT_ROLE_KEYS: RoleKey[] = [
  RoleKey.CURRENT_STUDENT,
  RoleKey.FORMER_STUDENT,
];

/** Sender details shown in a talk: name, photo, 第N期, 学年代表. */
const SENDER_SELECT = {
  nameRomaji: true,
  nameKanji: true,
  ...AVATAR_SELECT,
  roles: {
    where: {
      role: { in: STUDENT_ROLE_KEYS },
      cohortId: { not: null },
    },
    select: { cohort: { select: { number: true } } },
    take: 1,
  },
  positions: {
    where: { position: PositionKey.STUDENT_LEADER },
    select: { id: true },
  },
} as const;

const MESSAGE_SELECT = {
  id: true,
  userId: true,
  body: true,
  createdAt: true,
  deletedAt: true,
  mentionUserIds: true,
  mentionAll: true,
  user: { select: SENDER_SELECT },
} as const;

type MessageRow = {
  id: string;
  userId: string;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
  mentionUserIds: string[];
  mentionAll: boolean;
  user: {
    nameRomaji: string | null;
    nameKanji: string | null;
    id: string;
    avatarUrl: string | null;
    avatarPublic: boolean;
    familyId: string | null;
    gender: string | null;
    roles: { cohort: { number: number } | null }[];
    positions: { id: string }[];
  };
};

function toView(m: MessageRow, conn: Connections): ChatMessageView {
  return {
    id: m.id,
    userId: m.userId,
    name: m.user.nameRomaji ?? m.user.nameKanji ?? "—",
    avatar: photoFor(conn, m.user),
    cohort: m.user.roles[0]?.cohort?.number ?? null,
    rep: m.user.positions.length > 0,
    body: m.deletedAt ? "" : m.body,
    createdAt: m.createdAt.toISOString(),
    deleted: m.deletedAt !== null,
    mentionUserIds: m.deletedAt ? [] : m.mentionUserIds,
    mentionAll: m.deletedAt ? false : m.mentionAll,
  };
}

/**
 * Members may open a chat; admins may also look into group chats (to
 * moderate) but never into someone else's 1:1 talk.
 */
async function openGroup(groupId: unknown) {
  const user = await actionActive().catch(() => null);
  const id = Id.safeParse(groupId);
  if (!user || !id.success) return null;
  const [member, group] = await Promise.all([
    db.chatMember.findUnique({
      where: { groupId_userId: { groupId: id.data, userId: user.id } },
      select: { groupId: true },
    }),
    db.chatGroup.findUnique({ where: { id: id.data }, select: { kind: true } }),
  ]);
  if (!group) return null;
  const direct = group.kind === ChatGroupKind.DIRECT;
  if (!member && (direct || !user.isAdmin)) return null;
  return { user, groupId: id.data, member: Boolean(member), direct };
}

/** Realtime connection details, or null (the UI polls instead). */
export async function realtimeSessionAction(): Promise<{
  url: string;
  key: string;
} | null> {
  const user: CurrentUser | null = await actionActive().catch(() => null);
  if (!user) return null;
  return realtimePublic();
}

export type SendResult =
  | { ok: true; message: ChatMessageView }
  | { ok: false; error: "forbidden" | "invalid" | "tooFast" };

const MentionsSchema = z
  .object({
    userIds: z.array(Id).max(MAX_MENTIONS).default([]),
    all: z.boolean().default(false),
  })
  .default({ userIds: [], all: false });

export async function sendChatMessageAction(
  groupId: string,
  body: string,
  mentionsInput?: { userIds: string[]; all: boolean },
): Promise<SendResult> {
  const g = await openGroup(groupId);
  if (!g?.member) return { ok: false, error: "forbidden" };
  if (g.direct && (await directStopped(g.groupId, g.user.id)))
    return { ok: false, error: "forbidden" };
  const text = String(body ?? "").trim();
  if (!text || text.length > MAX_CHAT_MESSAGE)
    return { ok: false, error: "invalid" };
  const recent = await db.chatMessage.count({
    where: {
      userId: g.user.id,
      createdAt: { gt: new Date(Date.now() - 60_000) },
    },
  });
  if (recent >= 20) return { ok: false, error: "tooFast" };
  // Mentions: only other members of this chat; @全員 only in group chats.
  const parsed = MentionsSchema.safeParse(mentionsInput);
  const wanted = parsed.success ? parsed.data : { userIds: [], all: false };
  const mentioned = wanted.userIds.length
    ? (
        await db.chatMember.findMany({
          where: {
            groupId: g.groupId,
            userId: { in: wanted.userIds, not: g.user.id },
          },
          select: { userId: true },
        })
      ).map((m) => m.userId)
    : [];
  const mentionAll = wanted.all && !g.direct;
  const row = await db.chatMessage.create({
    data: {
      groupId: g.groupId,
      userId: g.user.id,
      body: text,
      mentionUserIds: mentioned,
      mentionAll,
    },
    select: MESSAGE_SELECT,
  });
  await db.chatMember.update({
    where: { groupId_userId: { groupId: g.groupId, userId: g.user.id } },
    data: { lastReadAt: row.createdAt },
  });
  const message = toView(row, await loadConnections(g.user.id));
  // A signal only; members load the message through chatMessagesAction.
  await broadcast([
    {
      topic: channelTopic("chat", g.groupId),
      event: "message",
      payload: { id: message.id },
    },
  ]);
  // Members with the app get a push right away (after the response);
  // everyone else is told about mentions and 1:1 messages if still unread
  // after 5 minutes (the chat-unread job).
  after(() =>
    pushChatMessage({
      groupId: g.groupId,
      senderId: g.user.id,
      mentionUserIds: mentioned,
      body: row.body,
    }),
  );
  return { ok: true, message };
}

/** Older messages (before) or new ones (after; the polling fallback). */
export async function chatMessagesAction(
  groupId: string,
  opts: { before?: string; after?: string },
): Promise<ChatMessageView[] | null> {
  const g = await openGroup(groupId);
  if (!g) return null;
  const before = opts.before ? new Date(opts.before) : null;
  const after = opts.after ? new Date(opts.after) : null;
  if (after) {
    const rows = await db.chatMessage.findMany({
      where: { groupId: g.groupId, createdAt: { gt: after } },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: MESSAGE_SELECT,
    });
    const conn = await loadConnections(g.user.id);
    return rows.map((r) => toView(r, conn));
  }
  const rows = await db.chatMessage.findMany({
    where: {
      groupId: g.groupId,
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: CHAT_PAGE_SIZE,
    select: MESSAGE_SELECT,
  });
  const conn = await loadConnections(g.user.id);
  return rows.reverse().map((r) => toView(r, conn));
}

/** The member has seen everything up to now. */
export async function markChatReadAction(groupId: string): Promise<void> {
  const g = await openGroup(groupId);
  if (!g?.member) return;
  await db.chatMember.update({
    where: { groupId_userId: { groupId: g.groupId, userId: g.user.id } },
    data: { lastReadAt: new Date() },
  });
  // Senders' 既読 marks update live.
  await broadcast([
    { topic: channelTopic("chat", g.groupId), event: "read", payload: {} },
  ]);
}

/** When the other members last read the chat (for 既読 marks). */
export async function chatReadStateAction(
  groupId: string,
): Promise<string[] | null> {
  const g = await openGroup(groupId);
  if (!g) return null;
  const rows = await db.chatMember.findMany({
    where: { groupId: g.groupId, userId: { not: g.user.id } },
    select: { lastReadAt: true },
  });
  return rows.map((r) => r.lastReadAt.toISOString());
}

/** Why the 1:1 talk can't go on (see directStopReason); null = it can. */
async function directStopped(
  groupId: string,
  meId: string,
): Promise<DirectStop | null> {
  const other = await db.chatMember.findFirst({
    where: { groupId, userId: { not: meId } },
    select: { userId: true },
  });
  if (!other) return "blocked";
  return directStopReason(meId, other.userId);
}

export type StartDirectResult =
  | { ok: true; groupId: string }
  | { ok: false; error: DirectDenial | "forbidden" };

/** Open (or create) the 1:1 talk with another member. */
export async function startDirectChatAction(
  otherId: string,
): Promise<StartDirectResult> {
  const user = await actionActive().catch(() => null);
  const id = Id.safeParse(otherId);
  if (!user || !id.success) return { ok: false, error: "forbidden" };
  const existing = await db.chatGroup.findUnique({
    where: { key: directKey(user.id, id.data) },
    select: { id: true },
  });
  // An existing talk reopens unless someone blocked the other or their
  // member types no longer allow it.
  if (existing) {
    const stopped = await directStopped(existing.id, user.id);
    if (stopped) return { ok: false, error: stopped };
    return { ok: true, groupId: await openDirectChat(user.id, id.data) };
  }
  const denial = await directChatDenial(user.id, id.data);
  if (denial) return { ok: false, error: denial };
  return { ok: true, groupId: await openDirectChat(user.id, id.data) };
}

/** Authors delete their own messages; admins may delete any (moderation). */
export async function deleteChatMessageAction(
  messageId: string,
): Promise<{ ok: boolean }> {
  const user = await actionActive().catch(() => null);
  const id = Id.safeParse(messageId);
  if (!user || !id.success) return { ok: false };
  const m = await db.chatMessage.findUnique({
    where: { id: id.data },
    select: { groupId: true, userId: true, body: true, deletedAt: true },
  });
  if (!m || m.deletedAt || (m.userId !== user.id && !user.isAdmin))
    return { ok: false };
  await db.chatMessage.update({
    where: { id: id.data },
    data: { deletedAt: new Date(), deletedById: user.id, body: "" },
  });
  if (m.userId !== user.id)
    await audit(
      user.id,
      "chat.message_delete",
      { type: "ChatMessage", id: id.data },
      { groupId: m.groupId, author: m.userId, body: m.body.slice(0, 200) },
    );
  await broadcast([
    {
      topic: channelTopic("chat", m.groupId),
      event: "delete",
      payload: { id: id.data },
    },
  ]);
  return { ok: true };
}

/** Turn the daily digest for a group off (or on again). */
export async function setChatMutedAction(
  groupId: string,
  muted: boolean,
): Promise<{ ok: boolean }> {
  const g = await openGroup(groupId);
  if (!g?.member) return { ok: false };
  await db.chatMember.update({
    where: { groupId_userId: { groupId: g.groupId, userId: g.user.id } },
    data: { muted: Boolean(muted) },
  });
  return { ok: true };
}
