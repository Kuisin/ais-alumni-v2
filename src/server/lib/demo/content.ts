import type {
  ChatInfo,
  ChatInfoMember,
  ChatList,
  ChatListRow,
  ChatMessage,
  ChatReactionSummary,
  ChatReactionsResult,
  ChatRoom,
  ChatRoomMember,
} from "@contract/chat";
import type { EventDetail, EventListItem, RsvpAnswer } from "@contract/events";
import type { HomeEvent, HomeNews } from "@contract/home";
import type {
  MessageDetail,
  MessageSummary,
  NewsDetail,
  NewsSummary,
} from "@contract/news";
import type { InboxItem } from "@contract/notifications";
import { toString as qrToString } from "qrcode";
import { isReactionEmoji, MAX_EMOJI_LENGTH } from "@/server/lib/chat-emoji";
import { agoMs, type DemoData, demoData, isoAgo, isoOnDay } from "./data";
import {
  DEMO_USER_ID,
  type DemoMember,
  demoAvatar,
  me,
  member,
  otherName,
  personName,
} from "./people";

/**
 * The demo's news, events, chats and notifications (data/*.json) as API
 * shapes, with times computed from now at request time.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const ago = (ms: number): string =>
  new Date(Date.now() - ms).toISOString();

// ---- News ----

export function newsSummaries(): NewsSummary[] {
  return [...demoData().news]
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        agoMs(a.posted) - agoMs(b.posted),
    )
    .map((p) => ({
      id: p.id,
      title: p.title,
      titleFallback: null,
      excerpt: p.excerpt,
      pinned: p.pinned,
      publishedAt: isoAgo(p.posted),
      sender: p.sender,
      unread: p.unread,
      needsAnswer: p.needsAnswer,
      adminView: false,
    }));
}

export function homeNews(): HomeNews[] {
  return newsSummaries()
    .slice(0, 3)
    .map(({ excerpt: _e, adminView: _a, ...n }) => n);
}

export function newsDetail(id: string): NewsDetail | undefined {
  const p = demoData().news.find((x) => x.id === id);
  if (!p) return undefined;
  return {
    id: p.id,
    adminView: false,
    pinned: p.pinned,
    publishedAt: isoAgo(p.posted),
    sender: p.sender,
    title: p.title,
    titleFallback: null,
    body: p.body,
    bodyFallback: null,
    cover: null,
    deadline: p.deadline ? isoOnDay(p.deadline) : null,
    closedAt: null,
    open: true,
    requireConfirm: p.requireConfirm,
    confirmedAt: p.confirmedByMe ? isoAgo(p.confirmedByMe) : null,
    confirmCount: p.confirmCount,
    polls: p.polls.map((poll) => ({
      id: poll.id,
      kind: poll.kind,
      question: poll.question,
      multiple: poll.multiple,
      voters: poll.voters,
      options: poll.options.map((o) => ({
        id: o.id,
        label: o.label,
        startsAt: o.starts ? isoOnDay(o.starts) : null,
        counts: { YES: o.yes, MAYBE: o.maybe, NO: o.no },
        mine: o.answers.find((a) => a.memberId === "me")?.answer ?? null,
        best: o.best,
        names: o.answers.map((a) => ({
          name: personName(a.memberId),
          answer: a.answer,
        })),
      })),
    })),
    attachments: [],
    allowComments: p.allowComments,
    reactions: p.reactions,
    comments: p.comments.map((c) => ({
      id: c.id,
      name: personName(c.authorId),
      body: c.body,
      createdAt: isoAgo(c.posted),
      hidden: false,
      mine: c.authorId === "me",
    })),
    isAdmin: false,
    maxCommentLength: 1000,
  };
}

// ---- あなた宛ての連絡 (Broadcast messages) ----

export function messageSummaries(): MessageSummary[] {
  return [...demoData().messages]
    .sort((a, b) => agoMs(a.sent) - agoMs(b.sent))
    .map((x) => ({
      id: x.id,
      title: x.title,
      sender: x.sender,
      sentAt: isoAgo(x.sent),
      edited: false,
      unread: false,
    }));
}

export function messageDetail(id: string): MessageDetail | undefined {
  const x = demoData().messages.find((y) => y.id === id);
  if (!x) return undefined;
  return {
    id: x.id,
    title: x.title,
    body: x.body,
    sender: x.sender,
    sentAt: isoAgo(x.sent),
    edited: false,
    sentTo: x.sentTo,
    isRecipient: true,
  };
}

// ---- Events ----

function events() {
  const now = Date.now();
  return demoData().events.map((e) => {
    const startsAt = isoOnDay(e.starts);
    const endsAt = e.ends ? isoOnDay(e.ends) : null;
    return {
      ...e,
      startsAt,
      endsAt,
      closesAt: isoOnDay(e.rsvpCloses),
      past: Date.parse(endsAt ?? startsAt) < now,
    };
  });
}

export function eventList(tab: "upcoming" | "past"): EventListItem[] {
  const list = events()
    .filter((e) => e.past === (tab === "past"))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  if (tab === "past") list.reverse();
  return list.map((e) => ({
    id: e.id,
    title: { text: e.title, fallback: null },
    startsAt: e.startsAt,
    location: e.location,
    sender: e.sender,
    myAnswer: e.myAnswer?.answer ?? null,
  }));
}

export function homeEvents(): HomeEvent[] {
  return eventList("upcoming").map((e) => ({
    id: e.id,
    title: e.title.text,
    titleFallback: null,
    startsAt: e.startsAt,
    location: e.location,
    sender: e.sender,
    myAnswer: e.myAnswer,
  }));
}

export async function eventDetail(
  id: string,
  answer?: { answer: RsvpAnswer; guests: number },
): Promise<EventDetail | undefined> {
  const e = events().find((x) => x.id === id);
  if (!e) return undefined;
  let going = e.going;
  let mine = e.myAnswer;
  if (answer && !e.past) {
    if (mine?.answer === "GOING") going -= 1 + mine.guests;
    const guests =
      answer.answer === "NOT_GOING"
        ? 0
        : Math.max(0, Math.min(e.maxGuests, answer.guests));
    mine = { answer: answer.answer, guests };
    if (mine.answer === "GOING") going += 1 + guests;
  }
  const open = !e.past && Date.parse(e.closesAt) > Date.now();
  const leftMs = Date.parse(e.closesAt) - Date.now();
  const ticket =
    mine && mine.answer !== "NOT_GOING"
      ? {
          qrSvg: await qrToString(`AIS Alumni demo ticket ${e.id}`, {
            type: "svg",
            margin: 1,
            errorCorrectionLevel: "M",
          }),
          name: me().name,
          kanji: null,
          checkedInAt: e.checkedIn ? isoOnDay(e.checkedIn) : null,
        }
      : null;
  return {
    id: e.id,
    title: { text: e.title, fallback: null },
    body: { text: e.body, fallback: null },
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    location: e.location,
    mapUrl: e.mapUrl,
    sender: e.sender,
    capacity: e.capacity,
    going,
    remaining: e.capacity === null ? null : Math.max(0, e.capacity - going),
    rsvp: {
      open,
      closesAt: e.closesAt,
      closedByOrganizer: false,
      full: e.capacity !== null && going >= e.capacity,
      left: open
        ? leftMs >= DAY
          ? { unit: "days", count: Math.floor(leftMs / DAY) }
          : { unit: "hours", count: Math.max(1, Math.floor(leftMs / HOUR)) }
        : null,
      maxGuests: e.maxGuests,
      mine,
    },
    ticket,
    checkInPath: null,
  };
}

// ---- Chats ----

type DemoChat = DemoData["chats"][number] & { others: DemoMember[] };

function withMembers(c: DemoData["chats"][number]): DemoChat {
  return {
    ...c,
    others: c.memberIds.map(member).filter((x): x is DemoMember => Boolean(x)),
  };
}

const isDirect = (c: { kind: string }) => c.kind === "DIRECT";
const fromMe = (from: string) => from === "me";

/** A chat from chats.json, or an empty 1:1 talk opened with POST /chat/direct. */
function findChat(id: string): DemoChat | undefined {
  const known = demoData().chats.find((c) => c.id === id);
  if (known) return withMembers(known);
  const prefix = "demo-chat-dm-";
  if (!id.startsWith(prefix)) return undefined;
  const other = member(id.slice(prefix.length));
  if (!other) return undefined;
  return withMembers({
    id,
    kind: "DIRECT",
    title: other.name,
    hint: "One-to-one chat",
    memberIds: [other.id],
    extraMemberCount: 0,
    unread: 0,
    mentioned: false,
    messages: [],
  });
}

export function directChatId(userId: string): string | undefined {
  if (!member(userId)) return undefined;
  const existing = demoData().chats.find(
    (c) => isDirect(c) && c.memberIds[0] === userId,
  );
  return existing?.id ?? `demo-chat-dm-${userId}`;
}

function cohortOf(x: DemoMember | null): number | null {
  return x?.role === "FORMER_STUDENT" ? x.classNumber : null;
}

function chatMessage(msg: DemoChat["messages"][number]): ChatMessage {
  const from = fromMe(msg.from) ? null : (member(msg.from) ?? null);
  return {
    id: msg.id,
    userId: fromMe(msg.from) ? DEMO_USER_ID : msg.from,
    name: from?.name ?? me().name,
    avatar: from ? demoAvatar(from.gender) : me().avatar,
    cohort: from ? cohortOf(from) : me().cohort,
    rep: from?.classRep ?? false,
    body: msg.body,
    createdAt: isoAgo(msg.sent),
    deleted: false,
    mentionUserIds: [],
    mentionAll: msg.mentionAll,
    reactions: reactionSummaries(msg.id),
  };
}

type DemoReaction = { emoji: string; by: string[] };

/**
 * Reactions the demo user changed, by message id (per server instance, like
 * the other demo state); the rest come from chats.json.
 */
const reactionState = new Map<string, DemoReaction[]>();

function reactionsOf(messageId: string): DemoReaction[] {
  const changed = reactionState.get(messageId);
  if (changed) return changed;
  for (const c of demoData().chats)
    for (const m of c.messages) if (m.id === messageId) return m.reactions;
  return [];
}

function reactionSummaries(messageId: string): ChatReactionSummary[] {
  return reactionsOf(messageId).map((r) => ({
    emoji: r.emoji,
    count: r.by.length,
    mine: r.by.includes("me"),
    names: r.by.slice(0, 10).map(personName),
  }));
}

/** The demo user's reaction toggled (POST …/reactions); invalid ones ignored. */
export function toggleDemoReaction(
  chatId: string,
  messageId: string,
  raw: string,
): ChatReactionsResult | undefined {
  if (!findChat(chatId)) return undefined;
  const emoji = raw.trim().slice(0, MAX_EMOJI_LENGTH);
  if (isReactionEmoji(emoji)) {
    const list = reactionsOf(messageId).map((r) => ({ ...r, by: [...r.by] }));
    const r = list.find((x) => x.emoji === emoji);
    if (r)
      r.by = r.by.includes("me")
        ? r.by.filter((x) => x !== "me")
        : [...r.by, "me"];
    else if (list.length < 20) list.push({ emoji, by: ["me"] });
    reactionState.set(
      messageId,
      list.filter((x) => x.by.length > 0),
    );
  }
  return { reactions: reactionSummaries(messageId) };
}

export function demoMessageReactions(
  chatId: string,
  messageId: string,
): ChatReactionsResult | undefined {
  if (!findChat(chatId)) return undefined;
  return { reactions: reactionSummaries(messageId) };
}

function roomMember(x: DemoMember): ChatRoomMember {
  return {
    id: x.id,
    name: x.name,
    avatar: demoAvatar(x.gender),
    cohort: cohortOf(x),
    rep: x.classRep,
  };
}

const meRoomMember = (): ChatRoomMember => ({
  id: DEMO_USER_ID,
  name: me().name,
  avatar: me().avatar,
  cohort: me().cohort,
  rep: false,
});

const memberCount = (c: DemoChat) => c.others.length + 1 + c.extraMemberCount;

export function chatList(): ChatList {
  const rows: ChatListRow[] = demoData()
    .chats.map(withMembers)
    .map((c) => {
      const last = c.messages.at(-1);
      let preview = `${memberCount(c)} members`;
      if (last) {
        const who = fromMe(last.from) ? "You" : personName(last.from);
        preview =
          isDirect(c) && !fromMe(last.from)
            ? last.body
            : `${who}: ${last.body}`;
      }
      return {
        id: c.id,
        direct: isDirect(c),
        joined: true,
        name: c.title,
        avatar:
          isDirect(c) && c.others[0] ? demoAvatar(c.others[0].gender) : null,
        memberCount: memberCount(c),
        preview,
        lastAt: last ? isoAgo(last.sent) : null,
        unread: c.unread,
        mentioned: c.mentioned,
      };
    });
  rows.sort(
    (a, b) => Date.parse(b.lastAt ?? "0") - Date.parse(a.lastAt ?? "0"),
  );
  return { rows, canStartDirect: true };
}

export function chatRoom(id: string): ChatRoom | undefined {
  const c = findChat(id);
  if (!c) return undefined;
  const members = [meRoomMember(), ...c.others.map(roomMember)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const unreadFrom = c.unread
    ? c.messages[c.messages.length - c.unread]
    : undefined;
  return {
    id: c.id,
    kind: c.kind,
    topic: `demo:chat:${c.id}`,
    title: c.title,
    direct: isDirect(c),
    member: true,
    moderator: false,
    memberCount: memberCount(c),
    members,
    partner: isDirect(c) && c.others[0] ? roomMember(c.others[0]) : null,
    messages: c.messages.map(chatMessage),
    hasOlder: false,
    reads: chatReads(id),
    readBy: chatReadBy(id),
    lastReadAt: unreadFrom ? ago(agoMs(unreadFrom.sent) + MIN) : ago(0),
    muted: false,
    notifyLevel: isDirect(c) ? "all" : "mentions",
    stopped: null,
  };
}

/** When the other members last read (既読 marks). */
export function chatReads(id: string): string[] {
  return chatReadBy(id).map((r) => r.at);
}

export function chatReadBy(id: string): { userId: string; at: string }[] {
  const c = findChat(id);
  if (!c) return [];
  return c.others
    .slice(0, 3)
    .map((x, i) => ({ userId: roomMember(x).id, at: ago((i + 1) * 30 * MIN) }));
}

export function chatInfo(id: string): ChatInfo | undefined {
  const c = findChat(id);
  if (!c) return undefined;
  const info = (x: DemoMember): ChatInfoMember => ({
    ...roomMember(x),
    otherNames: otherName(x),
    self: false,
    linked: true,
  });
  const self: ChatInfoMember = {
    ...meRoomMember(),
    otherNames: null,
    self: true,
    linked: false,
  };
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    direct: isDirect(c),
    hint: c.hint,
    memberCount: memberCount(c),
    partner: isDirect(c) && c.others[0] ? info(c.others[0]) : null,
    members: [
      self,
      ...c.others.map(info).sort((a, b) => a.name.localeCompare(b.name)),
    ],
    member: true,
    muted: false,
    notifyLevel: isDirect(c) ? "all" : "mentions",
  };
}

export function sentMessage(body: string): ChatMessage {
  return {
    id: `demo-cm-${Date.now()}`,
    userId: DEMO_USER_ID,
    name: me().name,
    avatar: me().avatar,
    cohort: me().cohort,
    rep: false,
    body,
    createdAt: new Date().toISOString(),
    deleted: false,
    mentionUserIds: [],
    mentionAll: /@(all|全員)\b/i.test(body),
    reactions: [],
  };
}

// ---- Notifications (お知らせ) ----

export function inboxItems(): InboxItem[] {
  return demoData().notifications.map(({ sent, ...n }) => ({
    ...n,
    sentAt: isoAgo(sent),
    channels: ["EMAIL"],
  }));
}
