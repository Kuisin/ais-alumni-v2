import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  chatMessagesAction,
  chatReadStateAction,
  deleteChatMessageAction,
  markChatReadAction,
  sendChatMessageAction,
  setChatMutedAction,
  startDirectChatAction,
} from "@/server/app/actions/chat";
import { reportChatAction } from "@/server/app/actions/chat-reports";
import { ChatGroupKind } from "@/server/generated/prisma/enums";
import { blockedUserIds, canViewProfile, toViewer } from "@/server/lib/authz";
import { AVATAR_SELECT, loadConnections, photoFor } from "@/server/lib/avatar";
import { CHAT_PAGE_SIZE, KIND_ORDER, mentionsIn } from "@/server/lib/chat";
import {
  chatMentionedGroups,
  chatUnreadByGroup,
  directChatAvailable,
  directChatCandidates,
  directStopReason,
  GROUP_SELECT,
  syncChatMembership,
} from "@/server/lib/chat-db";
import { chatGroupName } from "@/server/lib/chat-labels";
import { loadChatGroup } from "@/server/lib/chat-room";
import { db } from "@/server/lib/db";
import { DIRECT_CHAT_ENABLED } from "@/server/lib/features";
import { displayName, otherNames } from "@/server/lib/format";
import type {
  ChatInfo,
  ChatInfoMember,
  ChatList,
  ChatListRow,
  ChatMessagesPage,
  ChatReads,
  ChatRoom,
  ChatRoomMember,
  DirectCandidates,
  MuteResult,
  OkResult,
  ReportResult,
  SendMessageResult,
  StartDirectResult,
} from "@/server/lib/mobile/contract/chat";
import { ApiError, type Locale, notFound } from "@/server/lib/mobile/http";
import { chatNotifyLevel } from "@/server/lib/mobile/notifications";
import { channelTopic } from "@/server/lib/realtime";
import type { CurrentUser } from "@/server/lib/session";

/**
 * チャット for the native app: the same data, rules and wording as the
 * website's chat pages (src/app/[locale]/app/(member)/chat) — the loaders
 * follow those pages line by line, and every change goes through the
 * website's server actions (src/app/actions/chat*.ts), which apply the
 * access rules (members; admins may look into group chats, never into
 * others' 1:1 talks).
 */

/** Messages the "after" query returns at most (chatMessagesAction). */
const AFTER_LIMIT = 200;

/** @全員 in every language (the website room's ALL_LABELS). */
const ALL_LABELS = ["全員", "all"];

async function chatT(locale: Locale) {
  return getTranslations({ locale, namespace: "chat" });
}

/** The website's /app/chat (ChatListPage). */
export async function chatList(
  user: CurrentUser,
  locale: Locale,
): Promise<ChatList> {
  await syncChatMembership(user.id);
  const t = await chatT(locale);
  const mine = await db.chatMember.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const myIds = mine.map((m) => m.groupId);
  const groups = await db.chatGroup.findMany({
    // Admins also see (and can moderate) every group chat, never others' 1:1s.
    where: user.isAdmin
      ? { OR: [{ id: { in: myIds } }, { kind: { not: ChatGroupKind.DIRECT } }] }
      : { id: { in: myIds } },
    select: {
      ...GROUP_SELECT,
      _count: { select: { members: true } },
      members: {
        where: { userId: { not: user.id } },
        take: 1,
        select: {
          user: {
            select: { nameRomaji: true, nameKanji: true, ...AVATAR_SELECT },
          },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          body: true,
          createdAt: true,
          userId: true,
          user: { select: { nameRomaji: true, nameKanji: true } },
        },
      },
    },
  });
  const [unread, mentioned, conn, canStartDirect] = await Promise.all([
    chatUnreadByGroup(user.id),
    chatMentionedGroups(user.id),
    loadConnections(user.id),
    directChatAvailable(user.id),
  ]);

  const rows = groups
    // A 1:1 talk shows once someone has written.
    .filter((g) => g.kind !== ChatGroupKind.DIRECT || g.messages.length > 0)
    .map((g) => {
      const direct = g.kind === ChatGroupKind.DIRECT;
      const other = g.members[0]?.user;
      const last = g.messages[0];
      const who = last
        ? last.userId === user.id
          ? t("you")
          : (last.user.nameRomaji ?? last.user.nameKanji ?? "")
        : "";
      const row: ChatListRow = {
        id: g.id,
        direct,
        joined: myIds.includes(g.id),
        name: direct
          ? (other?.nameRomaji ?? other?.nameKanji ?? "—")
          : chatGroupName(t, g, locale),
        avatar: direct && other ? photoFor(conn, other) : null,
        memberCount: g._count.members,
        preview: last
          ? direct && last.userId !== user.id
            ? last.body
            : `${who}: ${last.body}`
          : t("members", { count: g._count.members }),
        lastAt: last?.createdAt.toISOString() ?? null,
        unread: unread.get(g.id) ?? 0,
        mentioned: mentioned.has(g.id),
      };
      return {
        row,
        order: KIND_ORDER.indexOf(g.kind) * 1000 + (g.cohort?.number ?? 0),
      };
    })
    .sort((a, b) =>
      a.row.lastAt !== b.row.lastAt
        ? (b.row.lastAt ?? "").localeCompare(a.row.lastAt ?? "")
        : a.order - b.order,
    )
    .map((r) => r.row);

  return { rows, canStartDirect };
}

type LoadedGroup = NonNullable<Awaited<ReturnType<typeof loadChatGroup>>>;

async function openRoom(user: CurrentUser, id: string): Promise<LoadedGroup> {
  const found = await loadChatGroup(id, user);
  if (!found) throw notFound();
  return found;
}

/** The website's /app/chat/[id] (ChatRoomPage). */
export async function chatRoom(
  user: CurrentUser,
  locale: Locale,
  id: string,
): Promise<ChatRoom> {
  const { group, me, direct } = await openRoom(user, id);
  const t = await chatT(locale);
  const [messages, reads, conn] = await Promise.all([
    chatMessagesAction(group.id, {}),
    chatReadStateAction(group.id),
    loadConnections(user.id),
  ]);
  const members: ChatRoomMember[] = group.members.map(({ user: u }) => ({
    id: u.id,
    name: u.nameRomaji ?? u.nameKanji ?? "—",
    avatar: photoFor(conn, u),
    cohort: u.roles[0]?.cohort?.number ?? null,
    rep: u.positions.length > 0,
  }));
  const other = members.find((m) => m.id !== user.id) ?? null;
  // A 1:1 talk stops when either side has blocked the other or their
  // member types no longer allow it.
  const stopped = direct
    ? other
      ? await directStopReason(user.id, other.id)
      : "blocked"
    : null;
  const page = messages ?? [];
  return {
    id: group.id,
    kind: group.kind,
    topic: channelTopic("chat", group.id),
    title: direct ? (other?.name ?? "—") : chatGroupName(t, group, locale),
    direct,
    member: Boolean(me),
    moderator: user.isAdmin,
    memberCount: group._count.members,
    members,
    partner: direct ? other : null,
    messages: page,
    hasOlder: page.length >= CHAT_PAGE_SIZE,
    reads: reads ?? [],
    lastReadAt: me?.lastReadAt.toISOString() ?? null,
    muted: me?.muted ?? false,
    notifyLevel: me ? chatNotifyLevel(me) : "mentions",
    stopped,
  };
}

export const MessagesQuery = z
  .object({
    before: z.iso.datetime().optional(),
    after: z.iso.datetime().optional(),
  })
  .refine((q) => !(q.before && q.after), { message: "before or after" });

/** Older messages (before) or new ones (after), as the website room loads them. */
export async function chatMessages(
  id: string,
  q: z.infer<typeof MessagesQuery>,
): Promise<ChatMessagesPage> {
  const rows = await chatMessagesAction(id, q);
  if (!rows) throw notFound();
  return {
    messages: rows,
    hasMore: rows.length >= (q.after ? AFTER_LIMIT : CHAT_PAGE_SIZE),
  };
}

export const SendBody = z.object({ body: z.string().max(10_000) });

const SEND_STATUS = { forbidden: 403, invalid: 400, tooFast: 429 } as const;

/**
 * Post a message. Mentions are read from the text against the talk's
 * members, as the website's composer does (mentionsIn); the action keeps
 * only members of this talk, and @全員 only in groups.
 */
export async function sendMessage(
  user: CurrentUser,
  id: string,
  { body }: z.infer<typeof SendBody>,
): Promise<SendMessageResult> {
  let mentions = { userIds: [] as string[], all: false };
  if (body.includes("@")) {
    const others = await db.chatMember.findMany({
      where: { groupId: id, userId: { not: user.id } },
      orderBy: { user: { nameRomaji: "asc" } },
      take: 2000,
      select: {
        user: { select: { id: true, nameRomaji: true, nameKanji: true } },
      },
    });
    mentions = mentionsIn(
      body,
      others.map(({ user: u }) => ({ id: u.id, name: displayName(u) })),
      ALL_LABELS,
    );
  }
  const r = await sendChatMessageAction(id, body, mentions);
  if (!r.ok) throw new ApiError(SEND_STATUS[r.error], r.error);
  return { message: r.message };
}

/**
 * The talk is open to the member (chatReadStateAction applies the same
 * rule as the room: members, and admins for group chats).
 */
async function requireVisible(id: string): Promise<string[]> {
  const reads = await chatReadStateAction(id);
  if (!reads) throw notFound();
  return reads;
}

/** Delete a message of this talk (own; admins any), as in the website room. */
export async function deleteMessage(
  id: string,
  messageId: string,
): Promise<OkResult> {
  await requireVisible(id);
  const m = await db.chatMessage.findUnique({
    where: { id: messageId },
    select: { groupId: true, deletedAt: true },
  });
  if (!m || m.groupId !== id) throw notFound();
  if (m.deletedAt) return { ok: true };
  const r = await deleteChatMessageAction(messageId);
  if (!r.ok) throw new ApiError(403, "forbidden");
  return { ok: true };
}

export async function chatReads(id: string): Promise<ChatReads> {
  return { reads: await requireVisible(id) };
}

/** The member has seen everything up to now (senders' 既読 update). */
export async function markRead(id: string): Promise<OkResult> {
  await requireVisible(id);
  await markChatReadAction(id);
  return { ok: true };
}

export const MuteBody = z.object({ muted: z.boolean() });

/** The daily digest for this talk off (muted) or on. */
export async function setMuted(
  id: string,
  { muted }: z.infer<typeof MuteBody>,
): Promise<MuteResult> {
  await requireVisible(id);
  const r = await setChatMutedAction(id, muted);
  if (!r.ok) throw new ApiError(403, "forbidden");
  return { muted };
}

/** The website's /app/chat/[id]/info (ChatInfoPage). */
export async function chatInfo(
  user: CurrentUser,
  locale: Locale,
  id: string,
): Promise<ChatInfo> {
  const { group, direct, me } = await openRoom(user, id);
  const t = await chatT(locale);
  const ids = group.members.map((m) => m.user.id);
  const [conn, access, blocked] = await Promise.all([
    loadConnections(user.id),
    db.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        state: true,
        dateOfBirth: true,
        familyId: true,
        managedById: true,
        roles: { select: { role: true } },
      },
    }),
    blockedUserIds(user.id),
  ]);
  const byId = new Map(access.map((a) => [a.id, a]));
  const blockedSet = new Set(blocked);
  const viewer = toViewer(user);
  const members: ChatInfoMember[] = group.members.map(({ user: u }) => {
    const a = byId.get(u.id);
    const linked =
      u.id === user.id ||
      (a
        ? canViewProfile(
            viewer,
            {
              id: a.id,
              state: a.state,
              roles: a.roles.map((r) => r.role),
              dateOfBirth: a.dateOfBirth,
              familyId: a.familyId,
              managed: a.managedById !== null,
            },
            { follow: null, blocked: blockedSet.has(u.id) },
          )
        : false);
    return {
      id: u.id,
      name: u.nameRomaji ?? u.nameKanji ?? "—",
      otherNames: otherNames(u),
      avatar: photoFor(conn, u),
      cohort: u.roles[0]?.cohort?.number ?? null,
      rep: u.positions.length > 0,
      self: u.id === user.id,
      linked,
    };
  });
  // You first, then everyone by name (as loaded).
  members.sort((a, b) => Number(b.self) - Number(a.self));
  const partner = direct ? (members.find((m) => !m.self) ?? null) : null;
  return {
    id: group.id,
    kind: group.kind,
    title: direct ? (partner?.name ?? "—") : chatGroupName(t, group, locale),
    direct,
    hint: direct
      ? t("room.direct")
      : t.has(`groupHints.${group.kind}`)
        ? t(`groupHints.${group.kind}`)
        : null,
    memberCount: group._count.members,
    partner,
    members,
    member: Boolean(me),
    muted: me?.muted ?? false,
    notifyLevel: me ? chatNotifyLevel(me) : "mentions",
  };
}

export const ReportBody = z.object({
  userId: z.string().max(64).nullable().optional(),
  // Checked by the action, which answers with its own codes.
  reason: z.string().max(40),
  detail: z.string().max(10_000),
});

const REPORT_STATUS = {
  forbidden: 403,
  reason: 400,
  detail: 400,
  rateLimited: 429,
} as const;

/** Report the talk, or someone in it (the website's ChatReportForm). */
export async function reportChat(
  id: string,
  input: z.infer<typeof ReportBody>,
): Promise<ReportResult> {
  await requireVisible(id);
  const fd = new FormData();
  fd.set("groupId", id);
  fd.set("userId", input.userId ?? "");
  fd.set("reason", input.reason);
  fd.set("detail", input.detail);
  const state = await reportChatAction(null, fd);
  if (state?.ok) return { ref: state.ref ?? "" };
  const code = state?.error ?? "forbidden";
  throw new ApiError(REPORT_STATUS[code], code);
}

/** The website's /app/chat/new (NewTalkPage). */
export async function directCandidates(
  user: CurrentUser,
): Promise<DirectCandidates> {
  if (!DIRECT_CHAT_ENABLED) throw notFound();
  const [available, people, conn] = await Promise.all([
    directChatAvailable(user.id),
    directChatCandidates(user.id),
    loadConnections(user.id),
  ]);
  return {
    available,
    people: people.map((p) => ({
      id: p.id,
      name: p.nameRomaji ?? p.nameKanji ?? "—",
      kanji: p.nameRomaji ? p.nameKanji : null,
      avatar: photoFor(conn, p),
    })),
  };
}

export const StartDirectBody = z.object({ userId: z.string().min(1).max(64) });

const START_STATUS = {
  disabled: 403,
  self: 400,
  notFound: 404,
  restricted: 403,
  notFriends: 403,
  blocked: 403,
  forbidden: 403,
} as const;

/** Open (or create) the 1:1 talk with another member (startDirectChatAction). */
export async function startDirect({
  userId,
}: z.infer<typeof StartDirectBody>): Promise<StartDirectResult> {
  const r = await startDirectChatAction(userId);
  if (!r.ok) throw new ApiError(START_STATUS[r.error], r.error);
  return { groupId: r.groupId };
}
